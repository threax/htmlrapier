﻿"use strict";

/**
 * This class provides a reusable way to fire events to multiple listeners.
 */
export function EventHandler() {
    var handlers = [];

    function add(context, handler) {
        if (context === undefined) {
            throw "context cannot be undefined";
        }
        if (handler === undefined) {
            throw "handler cannot be undefined";
        }
        handlers.push({
            handler: handler,
            context: context
        });
    }

    function remove(context, handler) {
        for (var i = 0; i < handlers.length; ++i) {
            if (handlers[i].handler === handler && handlers[i].context === context) {
                handlers.splice(i--, 1);
            }
        }
    }

    this.modifier = {
        add: add,
        remove: remove
    }

    /**
     * Fire the event. The listeners can return values, if they do the values will be added
     * to an array that is returned by this fuction.
     * @returns {array|undefined} an array of all the values returned by the listeners or undefiend if
     * no values are returned.
     */
    function fire() {
        var result;
        var nextResult;
        for (var i = 0; i < handlers.length; ++i) {
            var handlerObj = handlers[i];
            nextResult = handlerObj.handler.apply(handlerObj.context, arguments);
            if (nextResult !== undefined) {
                if (result === undefined) {
                    result = [];
                }
                result.push(nextResult);
            }
        }
        return result;
    }
    this.fire = fire;
}