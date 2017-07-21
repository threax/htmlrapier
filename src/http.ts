﻿///<amd-module name="hr.http"/>

"use strict";

import {Fetcher, Response} from 'hr.fetcher';
import {WindowFetch} from 'hr.windowfetch';

var defaultFetcher:Fetcher = new WindowFetch();

/**
 * A simple function to get data from a url without caching. This still
 * uses fetch, but is available since this is a a pretty common operation.
 * If you need something more advanced use fetch directly.
 * @param {string} url - The url to get from
 * @returns
 */
export function get<T>(url: string, fetcher?:Fetcher) : Promise<T> {
    if(fetcher === undefined){
        fetcher = defaultFetcher;
    }

    return fetcher.fetch(url, {
        method: "GET",
        cache: "no-cache",
        headers: {
            "Content-Type": "application/json; charset=UTF-8"
        },
        credentials: "include"
    }).then((response) => {
        return processResult(response);
    });
}

/**
 * A simple function to post to a url. This still uses fetch, but
 * simplifies its usage. If you need something more advanced use
 * fetch directly.
 */
export function post<T>(url: string, data?:any, fetcher?:Fetcher) : Promise<T> {
    if(fetcher === undefined){
        fetcher = defaultFetcher;
    }

    var body = undefined;

    if(data !== undefined){
        body = JSON.stringify(data);
    }

    return fetcher.fetch(url, {
        method: "POST",
        cache: "no-cache",
        headers: {
            "Content-Type": "application/json; charset=UTF-8"
        },
        body: body,
        credentials: "include"
    }).then((response) => {
        return processResult(response);
    });
}

function processResult<T>(response: Response) : Promise<T> {
    return response.text().then((data) => {
        let resultData = data === "" ? null : JSON.parse(data);
        if (response.status > 199 && response.status < 300) {
            return resultData;
        }
        throw resultData;
    });
}