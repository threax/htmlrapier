"use strict";

import * as typeId from 'hr.typeidentifiers';

/**
 * An interface for toggles.
 */
export interface Toggle {
    /**
     * Apply a named state to the toggle.
     */
    applyState(name: string);

    /**
     * Determine if this toggle is hooked up to anything. If the element or target for the
     * toggle could not be found, this will be false.
     */
    isUsable(): boolean;
}

var defaultStates = ['on', 'off']; //Reusuable states, so we don't end up creating tons of these arrays
var togglePlugins = [];

/**
 * Interface for typed toggles, provides a way to get the states as a string,
 * you should provide the names of all your functions here.
 */
export class TypedToggle implements Toggle {
    protected states: IToggleStates;

    /**
     * Get the states this toggle can activate.
     */
    public getPossibleStates(): string[] {
        return [];
    }

    /**
     * Set the toggle states used by this strong toggle, should not be called outside of
     * the toggle build function.
     */
    public setStates(toggle: IToggleStates) {
        this.states = toggle;
    }

    public applyState(name: string) {
        this.states.applyState(name);
    }

    public isUsable(): boolean {
        return !(typeId.isObject(this.states) && this.states.constructor.prototype == NullStates.prototype);
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

    public getPossibleStates() {
        return OnOffToggle.states;
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
            this.toggles[i].applyState(hideState);
        }
        toggle.applyState(showState);
    }
}

/**
 * Add a toggle plugin that can create additional items on the toggle chain.
 * @param {type} plugin
 */
export function addTogglePlugin(plugin) {
    togglePlugins.push(plugin);
}

export interface IToggleStates {
    addState(name: string, value: string);

    applyState(name: string);
}

/**
 * Base class for toggle state collections. Implemented as a chain.
 * @param {ToggleStates} next
 */
export abstract class ToggleStates implements IToggleStates {
    private next: ToggleStates;
    private states = {};

    constructor(next: ToggleStates) {
        this.next = next;
    }

    public addState(name: string, value: string) {
        this.states[name] = value;
    }

    public applyState(name: string): void {
        var state = this.states[name];
        this.activateState(state);
        if (this.next) {
            this.next.applyState(name);
        }
    }

    protected abstract activateState(value: string): void;
}

/**
 * This class holds multiple toggle states as a group. This handles multiple toggles
 * with the same name by bunding them up turning them on and off together.
 * @param {ToggleStates} next
 */
export class MultiToggleStates implements IToggleStates {
    private childStates: IToggleStates[];

    constructor(childStates: IToggleStates[]) {
        this.childStates = childStates;
    }

    public addState(name: string, value: string) {
        for (var i = 0; i < this.childStates.length; ++i) {
            this.childStates[i].addState(name, value);
        }
    }

    public applyState(name: string): void {
        for (var i = 0; i < this.childStates.length; ++i) {
            this.childStates[i].applyState(name);
        }
    }
}

/**
 * A simple toggle state that does nothing. Used to shim correctly if no toggles are defined for a toggle element.
 */
class NullStates extends ToggleStates {
    constructor(next: ToggleStates) {
        super(next);
    }

    public activateState(value: string): void {
        
    }
}

/**
 * A toggler that toggles style for an element
 */
class StyleStates extends ToggleStates {
    private element;
    private originalStyles;

    constructor(element, next: ToggleStates) {
        super(next);
        this.element = element;
        this.originalStyles = element.style.cssText || "";
    }

    public activateState(style) {
        if (style) {
            this.element.style.cssText = this.originalStyles + style;
        }
        else {
            this.element.style.cssText = this.originalStyles;
        }
    }
}

/**
* A toggler that toggles classes for an element. Supports animations using an 
* idle attribute (data-hr-class-idle) that if present will have its classes
* applied to the element when any animations have completed.
*/
class ClassStates extends ToggleStates {
    private element;
    private originalClasses;
    private idleClass;
    private stopAnimationCb; //Callback retains this context.

    constructor(element, next: ToggleStates) {
        super(next);
        this.element = element;
        this.originalClasses = element.getAttribute("class") || "";
        this.idleClass = element.getAttribute('data-hr-class-idle');
        this.stopAnimationCb = () => { this.stopAnimation() };
    }

    public activateState(classes) {
        if (classes) {
            this.element.setAttribute("class", this.originalClasses + ' ' + classes);
        }
        else {
            this.element.setAttribute("class", this.originalClasses);
        }
        this.startAnimation();
    }

    private startAnimation() {
        if (this.idleClass) {
            this.element.classList.remove(this.idleClass);
            this.element.removeEventListener('transitionend', this.stopAnimationCb);
            this.element.removeEventListener('animationend', this.stopAnimationCb);
            this.element.addEventListener('transitionend', this.stopAnimationCb);
            this.element.addEventListener('animationend', this.stopAnimationCb);
        }
    }

    private stopAnimation() {
        this.element.removeEventListener('transitionend', this.stopAnimationCb);
        this.element.removeEventListener('animationend', this.stopAnimationCb);
        this.element.classList.add(this.idleClass);
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
    var toggleStates: ToggleStates = null;
    for (var i = 0; i < states.length; ++i) {
        var name = states[i];
        var attr = attrPrefix + name;
        if (element.hasAttribute(attr)) {
            var value = element.getAttribute(attr);
            if (toggleStates === null) {
                toggleStates = new toggleConstructor(element, nextToggle);
            }
            toggleStates.addState(name, value);
        }
    }
    if (toggleStates) {
        return toggleStates;
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
export function build(element, states): IToggleStates {
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

    return toggle;
}