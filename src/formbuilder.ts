"use strict";

///<amd-module name="hr.formbuilder"/>

import * as component from 'hr.components';
import * as domquery from 'hr.domquery';
import { BindingCollection } from 'hr.bindingcollection';

export interface JsonSchema {
    title?: string;
    type?: string;
    additionalProperties?: boolean;
    properties?: JsonPropertyMap;
}

export interface JsonProperty {
    title?: string;
    type?: string | string[];
    format?: string;
    items?: JsonSchema;
    "x-ui-order"?: number;
    "x-ui-type"?: string;
    "x-values"?: JsonLabel[];
}

export interface ProcessedJsonProperty extends JsonProperty {
    buildName: string;
    buildType: string;
    buildOrder: number;
    buildValues?: JsonLabel[];
}

export type JsonPropertyMap = { [key: string]: JsonProperty };

export interface JsonLabel {
    label: string;
    value: any;
}

export class SpecialFormValues{
    private special: ISpecialFormValue[] = [];

    public add(value: ISpecialFormValue): void {
        this.special.push(value);
    }

    public setData(data: any): void {
        for(var i = 0; i < this.special.length; ++i){
            this.special[i].setData(data);
        }
    }

    public recoverData(data: any): void {
        for(var i = 0; i < this.special.length; ++i){
            var item = this.special[i];
            var subData = item.getData();
            data[item.getName()] = subData;
        }
    }
}

export interface ISpecialFormValue{
    getName(): string;

    getData(): any;

    setData(data: any);
}

class ArrayEditorRow {

}

class ArrayEditor implements ISpecialFormValue {
    private itemsHandle: HTMLElement;

    constructor(private name: string, bindings: BindingCollection, private schema: JsonSchema){
        if(schema){

        }

        this.itemsHandle = bindings.getHandle("items");
        if(this.itemsHandle === null){
            throw new Error("Could not find a handle named items when creating an array editor. Does your template define a data-hr-handle='items' attribute?");
        }
        bindings.setListener(this);
    }

    public add(evt: Event): void {
        evt.preventDefault();
        buildForm('hr.defaultform', this.schema, this.itemsHandle, this.name, true);
    }

    public getData(): any {

    }

    public setData(data: any) {

    }

    public getName(): string{
        return this.name;
    }
}

export function buildForm(componentName: string, schema: JsonSchema, parentElement: HTMLElement, baseName?: string, ignoreExisting?: boolean): SpecialFormValues {
    ////Clear existing elements
    //while (formElement.lastChild) {
    //    formElement.removeChild(formElement.lastChild);
    //}
    var specialValues = new SpecialFormValues();

    if(ignoreExisting === undefined){
        ignoreExisting = false;
    }

    if(baseName === undefined){
        baseName = "";
    }
    
    var dynamicInsertElement = domquery.first("[data-hr-form-end]", parentElement);
    var propArray: ProcessedJsonProperty[] = [];
    var props = schema.properties;
    if(props === undefined){
        //No props, add the schema itself as a property
        propArray.push(processProperty(schema, baseName));
    }
    else {
        for(var key in props){
            propArray.push(processProperty(props[key], baseName + key));
        }

        propArray.sort((a, b) =>{
            return a.buildOrder - b.buildOrder;
        });
    }

    for(var i = 0; i < propArray.length; ++i){
            var item = propArray[i];
            var existing = domquery.first('[name=' + item.buildName + ']', parentElement);
            if(ignoreExisting || existing === null){
                //Create component if it is null
                var bindings = component.one(componentName, item, parentElement, dynamicInsertElement, undefined, (i) => {
                    return i.buildType;
                });

                //Refresh existing, should be found now, when doing this always grab the last match.
                var elements = domquery.all('[name=' + item.buildName + ']', parentElement);
                if(elements.length > 0){
                    existing = elements[elements.length - 1];
                }
                else{
                    existing = null;
                }

                if(item.buildType === "arrayEditor"){
                    var editor = new ArrayEditor(item.buildName, bindings, item.items);
                    specialValues.add(editor);
                }
            }

            //If this is a child form, mark the element as a child so the form serializer will ignore it
            if(IsElement(existing)){
                existing.setAttribute("data-hr-form-level", baseName);
            }

            //If there are values defined for the element, put them on the page, this works for both
            //predefined and generated elements, which allows you to have predefined selects that can have dynamic values
            if(item.buildValues !== undefined){
                if(IsSelectElement(existing)){
                    for(var q = 0; q < item.buildValues.length; ++q){
                        var current = item.buildValues[q];
                        var option = document.createElement("option");
                        option.text = current.label;
                        option.value = current.value;
                        existing.options.add(option);
                    }
                }
            }
        }

    return specialValues;
}

function IsElement(element: Node): element is HTMLElement{
    return element && (element.nodeName !== undefined);
}

function IsSelectElement(element: Node): element is HTMLSelectElement{
    return element && (element.nodeName === 'SELECT');
}

function processProperty(prop: JsonProperty, name: string): ProcessedJsonProperty{
    var processed = Object.create(prop);
    processed.buildName = name;
    if(processed.title === undefined){ //Set title if it is not set
        processed.title = processed.buildName;
    }

    if(prop["x-ui-order"] !== undefined){
        processed.buildOrder = prop["x-ui-order"];
    }
    else{
        processed.buildOrder = Number.MAX_VALUE;
    }

    //Set this build type to what has been passed in, this will be processed further below
    processed.buildType = getPropertyType(prop).toLowerCase();

    //Look for collections, anything defined as an array or that has x-values defined
    if(processed.buildType === 'array'){
        if(prop["x-values"] !== undefined){
            //Type with values, make a combo box or checkboxes depending on what the user asked for
            var xValues = prop["x-values"];
            processed.buildValues = xValues;
            //Only supports checkbox and multiselect ui types. Checkboxes have to be requested.
            if(prop["x-ui-type"] === "checkbox"){
                //Nothing for checkboxes yet, just be a basic multiselect until they are implemented
                processed.buildType = "multiselect";
            }
            else{
                processed.buildType = "multiselect";
            }
        }
        else{
            //Array of complex objects, since values are not provided
            processed.buildType = "arrayEditor";
        }
    }
    else{
        //Not an array type, handle as single value
        if(prop["x-values"] !== undefined){
            //Type with values, make a combo box or checkboxes depending on what the user asked for
            var xValues = prop["x-values"];
            processed.buildValues = xValues;
            if(prop["x-ui-type"] !== undefined){
                processed.buildType = prop["x-ui-type"];
            }
            else{
                processed.buildType = "select";
            }
        }
        else
        {
            //Regular type, no options, derive html type
            if(prop["x-ui-type"] !== undefined){
                processed.buildType = prop["x-ui-type"];
            }
            else{
                switch(processed.buildType){
                    case 'integer':
                        processed.buildType = 'number';
                        break;
                    case 'boolean':
                        processed.buildType = 'checkbox';
                        break;
                }
            }
        }
    }

    return processed;
}

function getPropertyType(prop: JsonProperty) {
    if (Array.isArray(prop.type)) {
        for (var j = 0; j < prop.type.length; ++j) {
            if (prop.type[j] !== "null") {
                return prop.type[j];
            }
        }
    }
    else {
        return prop.type;
    }
    return "null";
}