"use strict";

jsns.define("hr.models", [
    "hr.form",
    "hr.textstream",
    "hr.components",
    "hr.typeidentifiers",
    "hr.domquery"
],
function(exports, module, forms, TextStream, components, typeId, domQuery){

    function sharedClearer(i) {
        return "";
    }

    function FormModel(form, src) {
        this.setData = function (data) {
            forms.populate(form, data);
        }

        this.appendData = this.setData;

        function clear() {
            forms.populate(form, sharedClearer);
        }
        this.clear = clear;

        this.getData = function () {
            return forms.serialize(form);
        }

        this.getSrc = function () {
            return src;
        }
    }

    function ComponentModel(element, src, component) {
        this.setData = function (data, createdCallback, variantFinderCallback) {
            components.empty(element);
            this.appendData(data, createdCallback, variantFinderCallback);
        }

        this.appendData = function (data, createdCallback, variantFinderCallback) {
            if (typeId.isArray(data) || typeId.isForEachable(data) || typeId.isFunction(data)) {
                components.repeat(component, element, data, createdCallback, variantFinderCallback);
            }
            else if (data) {
                components.single(component, element, data, createdCallback, variantFinderCallback);
            }
        }

        function clear() {
            components.empty(element);
        }
        this.clear = clear;

        this.getData = function () {
            return {};
        }

        this.getSrc = function () {
            return src;
        }
    }

    function TextNodeModel(element, src) {
        var dataTextElements = undefined;

        this.setData = function (data) {
            dataTextElements = bindData(data, element, dataTextElements);
        }

        function clear() {
            dataTextElements = bindData(sharedClearer, element, dataTextElements);
        }
        this.clear = clear;

        this.appendData = this.setData;

        this.getData = function () {
            return {};
        }

        this.getSrc = function () {
            return src;
        }
    }

    function bindData(data, element, dataTextElements) {
        //No found elements, iterate everything.
        if (dataTextElements === undefined) {
            dataTextElements = [];
            domQuery.iterateNodes(element, NodeFilter.SHOW_TEXT, function (node) {
                var textStream = new TextStream(node.textContent);
                if (textStream.foundVariable()) {
                    node.textContent = textStream.format(data);
                    dataTextElements.push({
                        node: node,
                        stream: textStream
                    });
                }
            });
        }
        //Already found the text elements, output those.
        else {
            for (var i = 0; i < dataTextElements.length; ++i) {
                var node = dataTextElements[i];
                node.node.textContent = node.stream.format(data);
            }
        }

        return dataTextElements;
    }

    function build(element) {
        var src = element.getAttribute('data-hr-model-src');
        if (element.nodeName === 'FORM' || element.nodeName == 'INPUT' || element.nodeName == 'TEXTAREA') {
            return new FormModel(element, src);
        }
        else {
            var component = element.getAttribute('data-hr-model-component');
            if (component) {
                return new ComponentModel(element, src, component);
            }
            else {
                return new TextNodeModel(element, src);
            }
        }
    }
    exports.build = build;

    function NullModel() {
        this.setData = function (data) {

        }

        this.appendData = this.setData;

        this.getData = function () {
            return {};
        }

        this.getSrc = function () {
            return "";
        }
    }
    exports.NullModel = NullModel;
});