﻿///<amd-module name="hr.accesstokens"/>

import * as http from 'hr.http';
import * as uri from 'hr.uri';
import { Fetcher, RequestInfo, RequestInit, Response, Request } from 'hr.fetcher';
import * as events from 'hr.eventdispatcher';
import * as ep from 'hr.externalpromise';

//From https://github.com/auth0/jwt-decode/blob/master/lib/base64_url_decode.js
function b64DecodeUnicode(str: string) {
    return decodeURIComponent(atob(str).replace(/(.)/g, function(m, p) {
        var code = p.charCodeAt(0).toString(16).toUpperCase();
        if (code.length < 2) {
            code = '0' + code;
        }
        return '%' + code;
    }));
}

function base64_url_decode(str: string) {
    var output = str.replace(/-/g, "+").replace(/_/g, "/");
    switch (output.length % 4) {
        case 0:
            break;
        case 2:
            output += "==";
            break;
        case 3:
            output += "=";
            break;
        default:
            throw "Illegal base64url string!";
    }

    try {
        return b64DecodeUnicode(output);
    } catch (err) {
        return atob(output);
    }
};

//From https://github.com/auth0/jwt-decode/blob/master/lib/index.js
function parseJwt(token: string, options?: any) {
    if (typeof token !== 'string') {
        throw new Error('Invalid token specified');
    }

    options = options || {};
    var pos = options.header === true ? 0 : 1;
    return JSON.parse(base64_url_decode(token.split('.')[pos]));
};

export interface IAccessWhitelist {
    canSendAccessToken(url: RequestInfo): boolean;
}

function requestIsRequestObject(test: RequestInfo): test is Request {
    return (<Request>test).url !== undefined;
}

export class AccessWhitelist implements IAccessWhitelist {
    private whitelist: uri.Uri[] = [];

    constructor(whitelist?: string[]) {
        if (whitelist) {
            for (var i = 0; i < whitelist.length; ++i) {
                this.add(whitelist[i]);
            }
        }
    }

    public add(url: string) {
        this.whitelist.push(new uri.Uri(this.transformInput(url)));
    }

    public canSendAccessToken(url: RequestInfo): boolean {
        var testUri: uri.Uri;
        if (requestIsRequestObject(url)) {
            testUri = new uri.Uri(this.transformInput(url.url));
        }
        else {
            testUri = new uri.Uri(this.transformInput(url));
        }

        for (var i = 0; i < this.whitelist.length; ++i) {
            var item = this.whitelist[i];
            //Check to see if the urls match here, check that authorities match and
            //that the path for the item starts with the whitelisted path.
            if ((item.protocol === 'HTTPS' || item.protocol === '') //Accept https or empty protocol only 
                && item.authority == testUri.authority
                && (<any>testUri.path).startsWith(item.path)) {
                return true;
            }
        }

        return false;
    }

    private transformInput(url: string): string {
        return url.toLocaleUpperCase();
    }
}

class TokenManager {
    private currentToken: string;
    private startTime: number;
    private currentSub: string;
    private expirationTick: number;
    private needLoginEvent: events.PromiseEventDispatcher<boolean, TokenManager> = new events.PromiseEventDispatcher<boolean, TokenManager>();
    private queuePromise: ep.ExternalPromise<string> = null;

    constructor(private tokenPath: string) {

    }

    public getToken(): Promise<string> {
        //First check if we should queue the request
        if (this.queuePromise !== null) {
            return this.queuePromise.Promise;
        }

        //Do we need to refresh?
        if (this.startTime === undefined || Date.now() / 1000 - this.startTime > this.expirationTick) {
            //If we need to refresh, create the queue and fire the refresh
            this.queuePromise = new ep.ExternalPromise<string>();
            this.doRefreshToken(); //Do NOT await this, we want execution to continue.
            return this.queuePromise.Promise; //Here we return the queued promise that will resolve when doRefreshToken is done.
        }

        //Didn't need refresh, return current token.
        return Promise.resolve(this.currentToken);
    }

    private async doRefreshToken(): Promise<void> {
        try {
            var data: any = await http.post(this.tokenPath);
            this.currentToken = data.accessToken;

            var tokenObj = parseJwt(this.currentToken);

            if (this.currentSub !== undefined) {
                if (this.currentSub !== tokenObj.sub) { //Do not combine ifs
                    //Subjects do not match, clear tokens
                    this.clearToken();
                    throw new Error("Sub did not match on new token, likely a different user. Aborting refresh.");
                }
            }
            else {
                this.currentSub = tokenObj.sub;
            }

            this.startTime = tokenObj.nbf;
            this.expirationTick = (tokenObj.exp - this.startTime) / 2; //After half the token time has expired we will turn it in for another one.

            this.resolveQueue();
        }
        catch (err) {
            //This error happens only if we can't get the access token
            //If we did not yet have a token, allow the request to finish, the user is not logged in
            //Otherwise try to get the login
            if (this.currentToken === undefined || await this.fireNeedLogin()) {
                this.resolveQueue();
            }
            else {
                //Got false, which means no login was performed, return an error
                this.startTime = undefined;
                this.rejectQueue("Could not refresh access token or log back in.");
            }
        }
    }

    private clearToken(): void {
        this.currentToken = undefined;
        this.startTime = undefined;
        this.currentSub = undefined;
    }

    /**
     * Get an event listener for the given status code. Since this fires as part of the
     * fetch request the events can return promises to delay sending the event again
     * until the promise resolves.
     * @param status The status code for the event.
     */
    public get onNeedLogin(): events.EventModifier<events.FuncEventListener<Promise<boolean>, TokenManager>> {
        return this.needLoginEvent.modifier;
    }

    private async fireNeedLogin(): Promise<boolean> {
        var retryResults = await this.needLoginEvent.fire(this);

        if (retryResults) {
            //Take first result that is actually defined
            for (var i = 0; i < retryResults.length; ++i) {
                if (retryResults[i]) {
                    return retryResults[i];
                }
            }
        }

        return false;
    }

    private resolveQueue() {
        var promise = this.queuePromise;
        this.queuePromise = null;
        promise.resolve(this.currentToken);
    }

    private rejectQueue(err: any) {
        var promise = this.queuePromise;
        this.queuePromise = null;
        promise.reject(this.currentToken);
    }
}

export class AccessTokenManager extends Fetcher {
    public static isInstance(t: any): t is AccessTokenManager {
        return (<AccessTokenManager>t).onNeedLogin !== undefined
            && (<AccessTokenManager>t).fetch !== undefined;
    }

    private next: Fetcher;
    private accessWhitelist: IAccessWhitelist;
    private tokenManager: TokenManager;
    private needLoginEvent: events.PromiseEventDispatcher<boolean, AccessTokenManager> = new events.PromiseEventDispatcher<boolean, AccessTokenManager>();
    private _alwaysRefreshToken: boolean = false;

    constructor(tokenPath: string, accessWhitelist: IAccessWhitelist, next: Fetcher) {
        super();
        this.tokenManager = new TokenManager(tokenPath);
        this.tokenManager.onNeedLogin.add((t) => this.fireNeedLogin());
        this.next = next;
        this.accessWhitelist = accessWhitelist;
    }

    public async fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
        //Make sure the request is allowed to send an access token
        var whitelisted: boolean = this.accessWhitelist.canSendAccessToken(url);

        //Sometimes we always refresh the token even if the item is not on the whitelist
        //This is configured by the user
        if (whitelisted || this._alwaysRefreshToken) {
            var token: string = await this.tokenManager.getToken();
            if (whitelisted) {
                (<any>init.headers).bearer = token;
            }
        }

        return this.next.fetch(url, init);
    }

    /**
     * This event will fire if the token manager tried to get an access token and failed. You can try
     * to log the user back in at this point.
     */
    public get onNeedLogin(): events.EventModifier<events.FuncEventListener<Promise<boolean>, AccessTokenManager>> {
        return this.needLoginEvent;
    }

    public get alwaysRefreshToken(): boolean {
        return this._alwaysRefreshToken;
    }

    public set alwaysRefreshToken(value: boolean) {
        this._alwaysRefreshToken = value;
    }

    private async fireNeedLogin(): Promise<boolean> {
        var retryResults = await this.needLoginEvent.fire(this);

        if (retryResults) {
            for (var i = 0; i < retryResults.length; ++i) {
                if (retryResults[i]) {
                    return retryResults[i];
                }
            }
        }

        return false;
    }
}