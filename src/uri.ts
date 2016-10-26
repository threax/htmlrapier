﻿"use strict";

import { escape } from 'hr.escape';

/**
 * Get an object with the values from the query string. These values
 * will be sent through the escape function to help prevent xss before
 * you get the values back. All query string names will be set to lower case
 * to make looking them back up possible no matter the url case.
 * @returns {type} 
 */
export function getQueryObject() {
    var qs = window.location.search.substr(1).split('&');
    var val = {};
    for (var i = 0; i < qs.length; ++i) {
        var pair = qs[i].split('=', 2);
        if (pair.length === 1) {
            val[pair[0].toLowerCase()] = "";
        }
        else if (pair.length > 0) {
            val[pair[0].toLowerCase()] = escape(decodeURIComponent(pair[1].replace(/\+/g, ' ')));
        }
    }
    return val;
}

// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
// http://blog.stevenlevithan.com/archives/parseuri

var parseUriOptions = {
    strictMode: false,
    key: ["source", "protocol", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "anchor"],
    q: {
        name: "queryKey",
        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    parser: {
        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
        loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
};

export class Uri {
    source: string;
    protocol: string;
    authority: string;
    userInfo: string;
    user: string;
    password: string;
    host: string;
    port: string;
    relative: string;
    path: string;
    directory: string;
    file: string;
    query: string;
    anchor: string;

    private splitPath: string[];

    /**
     * Constructor. Optionally takes the url to parse, otherwise uses current
     * page url.
     * @param {string} url?
     */
    constructor(url?: string) {
        if (url === undefined && window !== undefined) {
            url = window.location.href;
        }

        var o = parseUriOptions;
        var m = o.parser[o.strictMode ? "strict" : "loose"].exec(url);
        var uri = this;
        var i = 14;

        while (i--) uri[o.key[i]] = m[i] || "";

        uri[o.q.name] = {};
        uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
            if ($1) uri[o.q.name][$1] = $2;
        });

        this.path = this.path.replace('\\', '/'); //Normalize slashes
    }

    /**
     * Get the section of the path specified by the index i.
     * @param {number} i The index of the section of the path to get use negative numbers to start at the end.
     * @returns
     */
    getPathPart(i: number): string {
        if (this.splitPath === undefined) {
            this.splitPath = this.path.split('/');
        }

        //Negative index, start from back
        if (i < 0) {
            if (-i < this.splitPath.length) {
                return this.splitPath[this.splitPath.length + i];
            }
            return null;
        }
        else if (i < this.splitPath.length) {
            return this.splitPath[i];
        }
        return null;
    }
}

export function parseUri(str: string) {
    return new Uri(str);
};