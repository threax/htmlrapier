"use strict";

import * as typeId from 'hr.typeidentifiers';

/**
 * An interface for toggles.
 */
export interface Toggle {
    applyState(value);
}

var defaultStates = ['on', 'off']; //Reusuable states, so we don't end up creating tons of these arrays
var togglePlugins = [];

/**
 * Interface for typed toggles, provides a way to get the states as a string,
 * you should provide the names of all your functions here.
 */
export class TypedToggle implements Toggle {
    protected toggle: Toggle;

    /**
     * Get the states this toggle can activate.
     */
    public getStates(): string[] {
        return [];
    }

    /**
     * Set the toggle used by this strong toggle, should not be called outside of
     * the toggle build function.
     */
    public setToggle(toggle: Toggle) {
        this.toggle = toggle;
    }

    public applyState(value) {
        safeApplyState(this.toggle, value);
    }
}

/**
 * A toggle that is on and off.
 */
export class OnOffToggle extends TypedToggle {
    private static states = ['on', 'off'];

    public on() {
        this.applyState("on");
    }

    public off() {
        this.applyState("off");
    }

    public getStates() {
        return OnOffToggle.states;
    }
}

/**
 * Add a toggle plugin that can create additional items on the toggle chain.
 * @param {type} plugin
 */
export function addTogglePlugin(plugin) {
    togglePlugins.push(plugin);
}

/**
 * This function will apply a state on a toggle in a safe manner while maintaining
 * the chain.
 * @param {type} toggle - The toggle to activate, can be null, which does nothing
 * @param {type} name - The name of the state to activate, toggle does not need to define
 * this state and the apply funciton for that toggle will be called with null for its value
 * in this case.
 */
function safeApplyState(toggle, name) {
    if (toggle) {
        var func = toggle[name];
        if (func) {
            func.apply(toggle);
        }
        else {
            var next = toggle.applyState(null);
            safeApplyState(next, name);
        }
    }
}

/**
 * Create a toggle function on the toggle.
 * @param {type} name - The name of the state.
 * @param {type} value - The value to apply for the state
 * @param {type} toggle - The toggle this state applies to.
 */
function createToggleState(name, value, toggle) {
    function activate() {
        var next = toggle.applyState(value);
        safeApplyState(next, name);
    }

    toggle[name] = activate;
}

/**
 * A simple toggle state that does nothing. Used to shim correctly if no toggles are defined for a toggle element.
 */
function NullStates(next) {
    function applyState(value) {
        return next;
    }
    this.applyState = applyState;
}

/**
 * A toggler that toggles style for an element
 */
function StyleStates(element, next) {
    var originalStyles = element.style.cssText || "";

    function applyState(style) {
        if (style) {
            element.style.cssText = originalStyles + style;
        }
        else {
            element.style.cssText = originalStyles;
        }
        return next;
    }
    this.applyState = applyState;
}

/**
* A toggler that toggles classes for an element. Supports animations using an 
* idle attribute (data-hr-class-idle) that if present will have its classes
* applied to the element when any animations have completed.
*/
function ClassStates(element, next) {
    var originalClasses = element.getAttribute("class") || "";
    var idleClass = element.getAttribute('data-hr-class-idle');

    function applyState(classes) {
        if (classes) {
            element.setAttribute("class", originalClasses + ' ' + classes);
        }
        else {
            element.setAttribute("class", originalClasses);
        }
        startAnimation();
        return next;
    }
    this.applyState = applyState;

    function startAnimation() {
        if (idleClass) {
            element.classList.remove(idleClass);
            element.removeEventListener('transitionend', stopAnimation);
            element.removeEventListener('animationend', stopAnimation);
            element.addEventListener('transitionend', stopAnimation);
            element.addEventListener('animationend', stopAnimation);
        }
    }

    function stopAnimation() {
        element.removeEventListener('transitionend', stopAnimation);
        element.removeEventListener('animationend', stopAnimation);
        element.classList.add(idleClass);
    }
}

/**
 * The Group defines a collection of toggles that can be manipulated together.
 */
export class Group {
    private toggles: Toggle[];

    constructor(...toggles: Toggle[]) {
        this.toggles = toggles;
    }

    /**
     * Add a toggle to the group.
     * @param toggle - The toggle to add.
     */
    add(toggle: Toggle) {
        this.toggles.push(toggle);
    }

    /**
     * This function will set all toggles in the group (including the passed one if its in the group) 
     * to the hideState and then will set the passed toggle to showState.
     * @param toggle - The toggle to set.
     * @param {string} [showState] - The state to set the passed toggle to.
     * @param {string} [hideState] - The state to set all other toggles to.
     */
    activate(toggle, showState?: string, hideState?: string) {
        if (showState === undefined) {
            showState = 'on';
        }

        if (hideState === undefined) {
            hideState = 'off';
        }

        for (var i = 0; i < this.toggles.length; ++i) {
            safeApplyState(this.toggles[i], hideState);
        }
        safeApplyState(toggle, showState);
    }
}

/**
 * Extract all the states from a given element to build a single toggle in the chain.
 * You pass in the prefix and states you want to extract as well as the constructor
 * to use to create new states.
 * @param {type} element - The element to extract toggles from
 * @param {type} states - The states to look for
 * @param {type} attrPrefix - The prefix for the attribute that defines the state. Will be concated with each state to form the lookup attribute.
 * @param {type} toggleConstructor - The constructor to use if a toggle is created.
 * @param {type} nextToggle - The next toggle to use in the chain
 * @returns {type} The toggle that should be the next element in the chain, will be the new toggle if one was created or nextToggle if nothing was created.
 */
function extractStates(element, states, attrPrefix, toggleConstructor, nextToggle) {
    var toggle = null;
    for (var i = 0; i < states.length; ++i) {
        var name = states[i];
        var attr = attrPrefix + name;
        if (element.hasAttribute(attr)) {
            var value = element.getAttribute(attr);
            if (toggle === null) {
                toggle = new toggleConstructor(element, nextToggle);
            }
            createToggleState(name, value, toggle);
        }
    }
    if (toggle) {
        return toggle;
    }
    return nextToggle;
}

/**
 * Build a toggle chain from the given element
 * @param {string} element - The element to build toggles for
 * @param {string[]} [states] - The states the toggle needs, will create functions on 
 * the toggle for each one. If this is undefined will default to "on" and "off".
 * @returns A new ToggleChain with the defined states as functions
 */
export function build(element, states): Toggle {
    if (states === undefined) {
        states = defaultStates;
    }
    var toggle = null;

    if (element !== null) {
        toggle = extractStates(element, states, 'data-hr-style-', StyleStates, toggle);
        toggle = extractStates(element, states, 'data-hr-class-', ClassStates, toggle);

        //Now toggle plugin chain
        for (var i = 0; i < togglePlugins.length; ++i) {
            toggle = togglePlugins[i](element, states, toggle);
        }
    }

    //If we get all the way here with no toggle, use the null toggle.
    if (toggle === null) {
        toggle = new NullStates(toggle);
    }

    //Make sure the top level toggle defines all the required funcitons
    //This trashes any properties that are not functions that are also state
    //names, or creates them if they don't exist. This allows the user to just
    //call function names for their states without worrying if they are defined.
    for (i = 0; i < states.length; ++i) {
        var state = states[i];
        if (!typeId.isFunction(toggle[state])) {
            createToggleState(state, null, toggle);
        }
    }

    return toggle;
}

/**
 * Determine if a given toggle is a null toggle.
 * @param toggle - the toggle to check
 * @returns {type} - True if toggle is a NullToggle
 */
export function isNullState(toggle) {
    return typeId.isObject(toggle) && toggle.constructor.prototype == NullStates.prototype;
}