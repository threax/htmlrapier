"use strict";

var jsns = (function () {
    var loaded = {};
    var unloaded = {};
    var runners = [];

    function isModuleLoaded(name) {
        return loaded[name] !== undefined;
    }

    function isModuleLoadable(name) {
        return unloaded[name] !== undefined;
    }

    function loadModule(name){
        var loaded = checkLib(unloaded[name]);
        if (loaded) {
            delete unloaded[name];
        }
        return loaded;
    }

    function Module() {
        this.exports = {};
    }

    function checkLib(library) {
        var dependencies = library.dependencies;
        var fullyLoaded = true;

        //Check to see if depenedencies are loaded and if they aren't and can be, load them
        for (var i = 0; i < dependencies.length; ++i) {
            var dep = dependencies[i];
            dep.loaded = isModuleLoaded(dep.name);
            if (!dep.loaded && isModuleLoadable(dep.name)) {
                dep.loaded = loadModule(dep.name);
            }
            fullyLoaded = fullyLoaded && dep.loaded;
        }

        //If all dependencies are loaded, load this library
        if (fullyLoaded) {
            var module = new Module();
            if (library.name) {
                loaded[library.name] = module;
            }
            var args = [module.exports, module];

            //Inject dependency arguments
            for (var i = 0; i < dependencies.length; ++i) {
                var dep = dependencies[i];
                args.push(loaded[dep.name].exports);
            }

            library.factory.apply(module, args);
        }

        return fullyLoaded;
    }

    function Library(name, depNames, factory) {
        this.name = name;
        this.factory = factory;
        this.dependencies = [];

        if (depNames) {
            for (var i = 0; i < depNames.length; ++i) {
                var depName = depNames[i];
                this.dependencies.push({
                    name: depName,
                    loaded: isModuleLoaded(depName)
                });
            }
        }
    }

    function loadRunners() {
        for (var i = 0; i < runners.length; ++i) {
            var runner = runners[i];
            if (checkLib(runner)) {
                runners.splice(i--, 1);
            }
        }
    }

    return {
        run: function (dependencies, factory) {
            runners.push(new Library(null, dependencies, factory));
            loadRunners();
        },

        define: function (name, dependencies, factory) {
            unloaded[name] = new Library(name, dependencies, factory);
            loadRunners();
        },

        debug: function () {
            if (runners.length > 0) {
                for (var i = 0; i < runners.length; ++i) {
                    var runner = runners[i];
                    console.log("Runner waiting " + runner);
                    for (var j = 0; j < runner.dependencies.length; ++j) {
                        var dependency = runner.dependencies[j];
                        if (!isModuleLoaded(dependency.name)) {
                            console.log("  dependency " + dependency.name);
                        }
                    }
                }
            }
            else {
                console.log("No runners remaining.");
            }
        }
    }
})();
(function () {
    //Startswith polyfill
    if (!String.prototype.startsWith) {
        String.prototype.startsWith = function (searchString, position) {
            position = position || 0;
            return this.substr(position, searchString.length) === searchString;
        };
    }

    //Polyfill for matches
    //https://developer.mozilla.org/en-US/docs/Web/API/Element/matches
    if (!Element.prototype.matches) {
        Element.prototype.matches =
            Element.prototype.matchesSelector ||
            Element.prototype.mozMatchesSelector ||
            Element.prototype.msMatchesSelector ||
            Element.prototype.oMatchesSelector ||
            Element.prototype.webkitMatchesSelector ||
            function (s) {
                var matches = (this.document || this.ownerDocument).querySelectorAll(s),
                    i = matches.length;
                while (--i >= 0 && matches.item(i) !== this) { }
                return i > -1;
            };
    }
})();
"use strict";

/**
 * @callback htmlrest_bindingcollection_eventcallback
 */

/**
 * @callback htmlrest_iter
 * @param {array} items - the items to iterate
 * @param {htmlrest_iter_cb} - the function to transform each object
 * @returns the transformed item and null when all items are iterated
 */

/**
 * @typedef {object} htmlrest_bindingcollection
 */

jsns.define("htmlrest.bindingcollection", [
    "htmlrest.escape",
    "htmlrest.typeidentifiers",
    "htmlrest.domquery",
    "htmlrest.textstream",
    "htmlrest.toggles",
    "htmlrest.models"
],
function (exports, module, escape, typeId, domQuery, TextStream, toggles, models) {
    function EventRunner(name, listener) {
        this.execute = function (evt) {
            var cb = listener[name];
            if (cb) {
                cb.call(this, evt);
            }
        }
    }

    function bindEvents(elements, listener) {
        for (var eIx = 0; eIx < elements.length; ++eIx) {
            var element = elements[eIx];
            domQuery.iterateNodes(element, NodeFilter.SHOW_ELEMENT, function (node) {
                //Look for attribute
                for (var i = 0; i < node.attributes.length; i++) {
                    var attribute = node.attributes[i];
                    if (attribute.name.startsWith('data-hr-on-')) {
                        var runner = new EventRunner(attribute.value, listener);
                        node.addEventListener(attribute.name.substr(11), runner.execute);
                    }
                }
            });
        }
    }

    function getToggle(name, elements, toggleCollection) {
        var toggle = toggleCollection[name];
        if (toggle === undefined) {
            var query = '[data-hr-toggle=' + name + ']';
            for (var eIx = 0; eIx < elements.length; ++eIx) {
                var element = elements[eIx];
                var toggleElement = domQuery.first(query, element);
                if (toggleElement) {
                    toggle = toggles.build(toggleElement);
                    toggleCollection[name] = toggle;
                    return toggle; //Found it, need to break element loop, done here if found
                }
                else {
                    toggle = null;
                }
            }
        }

        if (toggle === null) {
            toggle = new toggles.NullToggle();
        }

        return toggle;
    }

    function getModel(name, elements, modelCollection) {
        var model = modelCollection[name];
        if (model === undefined) {
            var query = '[data-hr-model=' + name + ']';
            for (var eIx = 0; eIx < elements.length; ++eIx) {
                var element = elements[eIx];
                var targetElement = domQuery.first(query, element);
                if (targetElement) {
                    model = models.build(targetElement);
                    modelCollection[name] = model;
                    return model; //Found it, need to break element loop, done here if found
                }
                else {
                    model = null;
                }
            }
        }

        if (model === null) {
            model = new models.NullModel();
        }

        return model;
    }

    function getConfig(elements) {
        var data = {};
        for (var eIx = 0; eIx < elements.length; ++eIx) {
            var element = elements[eIx];
            domQuery.iterateNodes(element, NodeFilter.SHOW_ELEMENT, function (node) {
                //Look for attribute
                for (var i = 0; i < node.attributes.length; i++) {
                    var attribute = node.attributes[i];
                    if (attribute.name.startsWith('data-hr-config-')) {
                        data[attribute.name.substr(15)] = attribute.value;
                    }
                }
            });
        }
        return data;
    }

    /**
     * 
     * @param {HtmlElement} elements
     */
    function BindingCollection(elements) {
        elements = domQuery.all(elements);
        var dataTextElements = undefined;
        var toggleCollection = undefined;
        var modelCollection = undefined;

        /**
         * Set the listener for this binding collection. This listener will have its functions
         * fired when a matching event is fired.
         * @param {type} listener
         */
        this.setListener = function (listener) {
            bindEvents(elements, listener);
        }

        /**
         * Set the data for this binding collection. Will run a format text on all text nodes
         * inside the collection. These nodes must have variables in them.
         * @param {type} data
         */
        this.setData = function (data) {
            dataTextElements = bindData(data, elements, dataTextElements);
        }

        this.getToggle = function (name) {
            if (toggleCollection === undefined) {
                toggleCollection = {};
            }
            return getToggle(name, elements, toggleCollection);
        }

        this.getModel = function (name) {
            if (modelCollection === undefined) {
                modelCollection = {};
            }
            return getModel(name, elements, modelCollection);
        }

        this.getConfig = function () {
            return getConfig(elements);
        }
    };

    module.exports = BindingCollection;
});
"use strict";

//Auto find components on the page and build them as components
jsns.run([
    "htmlrest.domquery",
    "htmlrest.bindingcollection",
    "htmlrest.textstream",
    "htmlrest.components"
],
function (exports, module, domquery, BindingCollection, TextStream, components) {
    var browserSupportsTemplates = 'content' in document.createElement('template');
    var anonTemplateIndex = 0;

    //Component creation function
    function createItem(data, componentStringStream, parentComponent, insertBeforeSibling) {
        var itemMarkup = componentStringStream.format(data);
        var newItems = str2DOMElement(itemMarkup);
        var arrayedItems = [];

        for (var i = 0; i < newItems.length; ++i) {
            var newItem = newItems[i];
            parentComponent.insertBefore(newItem, insertBeforeSibling);
            arrayedItems.push(newItem);
        }

        return new BindingCollection(arrayedItems);
    }

    function findComponentElements(context) {
        var attrName = "data-hr-component";
        var componentElements = domquery.all('[' + attrName + ']', context);
        //Read components backward, removing children from parents along the way.
        for (var i = componentElements.length - 1; i >= 0; --i) {
            (function () {
                var element = componentElements[i];
                var componentName = element.getAttribute(attrName);
                element.removeAttribute(attrName);
                var componentString = element.outerHTML;
                element.parentNode.removeChild(element);

                components.register(componentName, function (data, parentComponent, insertBeforeSibling) {
                    //First creation does more work with this function, then reregisters a simplified version
                    //Tokenize string
                    var tokenizedString = new TextStream(componentString);
                    //Register component again
                    components.register(componentName, function (data, parentComponent, insertBeforeSibling) {
                        //Return results, this is called for each subsequent creation
                        return createItem(data, tokenizedString, parentComponent, insertBeforeSibling);
                    });
                    //Return results
                    return createItem(data, tokenizedString, parentComponent, insertBeforeSibling);
                });
            })();
        };
    }
    findComponentElements();

    //Also grab the templates from the page and use them too
    function extractTemplate(element) {
        var componentName = element.getAttribute("id");

        //Check to see if this is an anonymous template, if so adjust the parent element and
        //name the template
        if (componentName === null) {
            componentName = 'AnonTemplate_' + anonTemplateIndex++;
            element.parentElement.setAttribute("data-hr-model-component", componentName);
        }

        //If the browser supports templates, need to create one to read it properly
        var templateElement = element;
        if (browserSupportsTemplates) {
            var templateElement = document.createElement('div');
            templateElement.appendChild(document.importNode(element.content, true));
        }

        //Look for nested child templates, do this before taking inner html so children are removed
        var childTemplates = templateElement.getElementsByTagName("TEMPLATE");
        while (childTemplates.length > 0) {
            extractTemplate(childTemplates[0]);
        }

        var componentString = templateElement.innerHTML.trim();
        element.parentNode.removeChild(element);

        components.register(componentName, function (data, parentComponent, insertBeforeSibling) {
            //First creation does more work with this function, then reregisters a simplified version
            //Tokenize string
            var tokenizedString = new TextStream(componentString);
            //Register component again
            components.register(componentName, function (data, parentComponent, insertBeforeSibling) {
                //Return results, this is called for each subsequent creation
                return createItem(data, tokenizedString, parentComponent, insertBeforeSibling);
            });
            //Return results
            return createItem(data, tokenizedString, parentComponent, insertBeforeSibling);
        });
    }

    var templateElements = document.getElementsByTagName("TEMPLATE");
    while (templateElements.length > 0) {
        extractTemplate(templateElements[0]);
    }

    //Actual creation function
    var str2DOMElement = function (html) {
        //From j Query and the discussion on http://krasimirtsonev.com/blog/article/Revealing-the-magic-how-to-properly-convert-HTML-string-to-a-DOM-element
        //Modified, does not support body tags and returns collections of children

        var wrapMap = {
            option: [1, "<select multiple='multiple'>", "</select>"],
            legend: [1, "<fieldset>", "</fieldset>"],
            area: [1, "<map>", "</map>"],
            param: [1, "<object>", "</object>"],
            thead: [1, "<table>", "</table>"],
            tr: [2, "<table><tbody>", "</tbody></table>"],
            col: [2, "<table><tbody></tbody><colgroup>", "</colgroup></table>"],
            td: [3, "<table><tbody><tr>", "</tr></tbody></table>"],
            body: [0, "", ""],
            _default: [1, "<div>", "</div>"]
        };
        wrapMap.optgroup = wrapMap.option;
        wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
        wrapMap.th = wrapMap.td;
        var match = /<\s*\w.*?>/g.exec(html);
        var element = document.createElement('div');
        if (match != null) {
            var tag = match[0].replace(/</g, '').replace(/>/g, '').split(' ')[0];
            var map = wrapMap[tag] || wrapMap._default, element;
            html = map[1] + html + map[2];
            element.innerHTML = html;
            // Descend through wrappers to the right content
            var j = map[0];
            while (j--) {
                element = element.lastChild;
            }
        } else {
            element.innerHTML = html;
        }

        return element.childNodes;
    }
});
"use strict";

//Components is a bit trickier, we want part of it to run right away
//First define the module
jsns.define("htmlrest.components", [
    "htmlrest.typeidentifiers",
    "htmlrest.domquery"
],
function(exports, module, typeId, domquery){
    var factory = {};

    /**
     * This callback is called when a component is created
     * @callback exports.createComponent~callback
     * @param {exports.component.BindingCollection} created
     * @param {object} data
     */

    /**
     * Create a new component specified by name with the data in data attached to parentComponent. You can also
     * get a callback whenever a component is created by passing a createdCallback.
     * @param {string} name - The name of the component to create. These are specified on the page with a data-hr-component
     * attribute or can be manually specified.
     * @param {object} data - The data to bind to the component.
     * @param {HTMLElement} parentComponent - The html element to attach the component to.
     * @param {exports.createComponent~callback} createdCallback - The callback called when the component is created.
     * @param {HTMLElement} insertBeforeSibling - The sibling to insert the new component before.
     * @returns {exports.component.BindingCollection} 
     */
    function single(name, parentComponent, data, createdCallback) {
        return doCreateComponent(name, data, parentComponent, null, createdCallback);
    }
    exports.single = single;

    /**
     * This callback is used to create components when they are requested.
     * @callback exports.registerComponent~callback
     * @param {exports.component.BindingCollection} created
     * @param {object} data
     * @returns {exports.component.BindingCollection} 
     */

    /**
     * Register a function with the component system.
     * @param {string} name - The name of the component
     * @param {exports.registerComponent~callback} createFunc - The function that creates the new component.
     */
    function register(name, createFunc) {
        factory[name] = createFunc;
    }
    exports.register = register;

    /**
     * Create a component for each element in data using that element as the data for the component.
     * @param {string} name - The name of the component to create. These are specified on the page with a data-hr-component
     * @param {HTMLElement} parentComponent - The html element to attach the component to.
     * @param {array|object|function} data - The data to repeat and bind, must be an array, object or function so it can be iterated.
     * If it is a function return the data and then return null to stop iteration.
     * @param {exports.createComponent~callback} createdCallback
     */
    function repeat(name, parentComponent, data, createdCallback) {
        //Look for an insertion point
        var insertBefore = null;
        var insertBefore = parentComponent.firstElementChild;
        while (insertBefore != null && !insertBefore.hasAttribute('data-htmlrest-insert')) {
            insertBefore = insertBefore.nextElementSibling;
        }

        //Output
        if (Array.isArray(data)) {
            for (var i = 0; i < data.length; ++i) {
                doCreateComponent(name, data[i], parentComponent, insertBefore, createdCallback);
            }
        }
        else if (typeId.isFunction(data)) {
            var current = data();
            while (current != null) {
                doCreateComponent(name, current, parentComponent, insertBefore, createdCallback);
                current = data();
            }
        }
        else if (typeId.isObject(data)) {
            for (var key in data) {
                doCreateComponent(name, data[key], parentComponent, insertBefore, createdCallback);
            }
        }
    }
    exports.repeat = repeat;

    /**
     * Remove all children from an html element.
     * @param {HTMLElement} parentComponent - The component to remove all children from
     */
    function empty(parentComponent) {
        parentComponent = domquery.first(parentComponent);
        var currentNode = parentComponent.firstChild;
        var nextNode = null;

        //Walk the nodes and remove any non keepers
        while (currentNode != null) {
            nextNode = currentNode.nextSibling;
            if (currentNode.nodeType !== 1 || !currentNode.hasAttribute('data-htmlrest-keep')) {
                parentComponent.removeChild(currentNode);
            }
            currentNode = nextNode;
        }
    }
    exports.empty = empty;

    function doCreateComponent(name, data, parentComponent, insertBeforeSibling, createdCallback) {
        parentComponent = domquery.first(parentComponent);
        if (factory.hasOwnProperty(name)) {
            var created = factory[name](data, parentComponent, insertBeforeSibling);
            if (createdCallback !== undefined) {
                createdCallback(created, data);
            }
            return created;
        }
        else {
            console.log("Failed to create component '" + name + "', cannot find factory, did you forget to define it on the page?")
        }
    }
});
"use strict";

jsns.define("htmlrest.controller", [
    "htmlrest.bindingcollection",
    "htmlrest.domquery"
],
function (exports, module, BindingCollection, domQuery) {
    /**
     * Create controller instances for all controllers named name using the given controllerConstructor function.
     * The created controllers will automatically be assigned as a listener to the bindings. This way the object
     * you create with your constructor funciton can define the main functions for the controller.
     * @param {type} name
     * @param {type} controllerConstructor
     */
    function create(name, controllerConstructor, context) {
        domQuery.iterate('[data-hr-controller="' + name + '"]', null, function (element) {
            var bindings = new BindingCollection(element);
            var controller = new controllerConstructor(bindings, context, null);
            bindings.setListener(controller);
            element.removeAttribute('data-hr-controller');
        });
    }

    exports.create = create;

    /**
     * This function will return a function that will create a controller when called with a BindingCollection inside.
     * This can be used in the callbacks for setData in model and when creating components.
     * @param {type} controllerConstructor
     */
    function createOnCallback(controllerConstructor, context) {
        return function (bindings, data) {
            var controller = new controllerConstructor(bindings, context, data);
            bindings.setListener(controller);
        }
    }

    exports.createOnCallback = createOnCallback;
});
"use strict";

jsns.define("htmlrest.domquery", [
    "htmlrest.typeidentifiers"
],
function(exports, module, typeId){
    /**
     * Derive the plain javascript element from a passed element
     * @param {string|HTMLElement} element - the element to detect
     * @returns {HTMLElement} - The located html element.
     */
    function first(element, context) {
        if (typeId.isString(element)) {
            if (context !== undefined) {
                if (this.matches(context, element)) {
                    element = context;
                }
                else {
                    element = context.querySelector(element);
                }
            }
            else {
                element = document.querySelector(element);
            }
        }
        return element;
    };
    exports.first = first;

    /**
     * Query all passed javascript elements
     * @param {string|HTMLElement} element - the element to detect
     * @param {HTMLElement} element - the context to search
     * @returns {array[HTMLElement]} - The results array to append to.
     * @returns {array[HTMLElement]} - The located html element. Will be the results array if one is passed otherwise a new one.
     */
    function all(element, context, results) {
        if (typeId.isString(element)) {
            if (results === undefined) {
                results = [];
            }

            if (context !== undefined) {
                if (this.matches(context, element)) {
                    results.push(context);
                }
                else {
                    nodesToArray(context.querySelectorAll(element), results);
                }
            }
            else {
                nodesToArray(document.querySelectorAll(element), results);
            }
        }
        else if (!typeId.isArray(element)) {
            if (results === undefined) {
                results = [element];
            }
            else {
                results.push(element);
            }
        }
        else {
            if (results === undefined) {
                results = element;
            }
            else {
                for (var i = 0; i < element.length; ++i) {
                    results.push(element[i]);
                }
            }
        }
        return results;
    };
    exports.all = all;

    /**
     * Query all passed javascript elements
     * @param {string|HTMLElement} element - the element to detect
     * @param {HTMLElement} element - the context to search
     * @param cb - Called with each htmlelement that is found
     */
    function iterate(element, context, cb) {
        if (typeId.isString(element)) {
            if (context) {
                if (this.matches(context, element)) {
                    cb(context);
                }
                else {
                    iterateQuery(context.querySelectorAll(element), cb);
                }
            }
            else {
                iterateQuery(document.querySelectorAll(element), cb);
            }
        }
        else if (!typeId.isArray(element)) {
            cb(element);
        }
        else {
            for (var i = 0; i < element.length; ++i) {
                cb(element[i]);
            }
        }
    };
    exports.iterate = iterate;

    function alwaysTrue(node) {
        return true;
    }

    /**
     * Iterate a node collection using createNodeIterator. There is no query for this version
     * as it iterates everything and allows you to extract what is needed.
     * @param  element - The root element
     * @param  cb - The function called for each item iterated
     * @param {NodeFilter} whatToShow - see createNodeIterator, defaults to SHOW_ALL
     */
    function iterateNodes(element, whatToShow, cb) {
        var iter = document.createNodeIterator(element, whatToShow, alwaysTrue, false);
        var node;
        while (node = iter.nextNode()) {
            cb(node);
        }
    }
    exports.iterateNodes = iterateNodes;

    /**
     * Determine if an element matches the given selector.
     * @param {type} element
     * @param {type} selector
     * @returns {type} 
     */
    function matches(element, selector) {
        return element.matches(selector);
    }
    exports.matches = matches;

    function nodesToArray(nodes, arr) {
        for (var i = 0; i < nodes.length; ++i) {
            arr.push(nodes[i]);
        }
    }

    function iterateQuery(nodes, cb) {
        for (var i = 0; i < nodes.length; ++i) {
            cb(nodes[i]);
        }
    }
});
"use strict";

jsns.define("htmlrest.escape", null,
function(exports, module){
    /**
     * Escape text to prevent html characters from being output. Helps prevent xss, called automatically
     * by formatText. If you manually write user data consider using this function to escape it, but it is
     * not needed using other htmlrest functions like repeat, createComponent or formatText.
     * @param {string} text - the text to escape.
     * @returns {type} - The escaped version of text.
     */
    function escape(text) {
        text = String(text);

        var status =
        {
            textStart: 0,
            bracketStart: 0,
            output: ""
        }
        for (var i = 0; i < text.length; ++i) {
            switch (text[i]) {
                case '<':
                    outputEncoded(i, text, status, '&lt;');
                    break;
                case '>':
                    outputEncoded(i, text, status, '&gt;');
                    break;
                case '"':
                    outputEncoded(i, text, status, '&quot;');
                    break;
                case '\'':
                    outputEncoded(i, text, status, '&#39;');
                    break;
                default:
                    break;
            }
        }

        if (status.textStart < text.length) {
            status.output += text.substring(status.textStart, text.length);
        }

        return status.output;
    }
    module.exports = escape;

    //Helper function for escaping
    function outputEncoded(i, text, status, replacement) {
        status.bracketStart = i;
        status.output += text.substring(status.textStart, status.bracketStart) + replacement;
        status.textStart = i + 1;
    }
});
"use strict";

jsns.define("htmlrest.form", [
    "htmlrest.domquery"
],
function(exports, module, domQuery){
    /**
     * Serialze a form to a javascript object
     * @param {HTMLElement|string} form - A selector or form element for the form to serialize.
     * @returns {object} - The object that represents the form contents as an object.
     */
    function serialize(form) {
        //This is from https://code.google.com/archive/p/form-serialize/downloads
        //Modified to return an object instead of a query string
        form = domQuery.first(form);

        if (!form || form.nodeName !== "FORM") {
            return;
        }
        var i, j, q = {};
        for (i = form.elements.length - 1; i >= 0; i = i - 1) {
            if (form.elements[i].name === "") {
                continue;
            }
            switch (form.elements[i].nodeName) {
                case 'INPUT':
                    switch (form.elements[i].type) {
                        case 'text':
                        case 'hidden':
                        case 'password':
                        case 'button':
                        case 'reset':
                        case 'submit':
                        case 'file':
                            q[form.elements[i].name] = form.elements[i].value;
                            break;
                        case 'checkbox':
                        case 'radio':
                            if (form.elements[i].checked) {
                                q[form.elements[i].name] = form.elements[i].value;
                            }
                            break;
                    }
                    break;
                case 'TEXTAREA':
                    q[form.elements[i].name] = form.elements[i].value;
                    break;
                case 'SELECT':
                    switch (form.elements[i].type) {
                        case 'select-one':
                            q[form.elements[i].name] = form.elements[i].value;
                            break;
                        case 'select-multiple':
                            for (j = form.elements[i].options.length - 1; j >= 0; j = j - 1) {
                                if (form.elements[i].options[j].selected) {
                                    q[form.elements[i].name] = form.elements[i].options[j].value;
                                }
                            }
                            break;
                    }
                    break;
                case 'BUTTON':
                    switch (form.elements[i].type) {
                        case 'reset':
                        case 'submit':
                        case 'button':
                            q[form.elements[i].name] = form.elements[i].value;
                            break;
                    }
                    break;
            }
        }
        return q;
    }
    exports.serialize = serialize;

    /**
     * Populate a form with data.
     * @param {HTMLElement|string} form - The form to populate or a query string for the form.
     * @param {object} data - The data to bind to the form, form name attributes will be mapped to the keys in the object.
     */
    function populate(form, data) {
        form = domQuery.first(form);
        var nameAttrs = domQuery.all('[name]', form);
        for (var i = 0; i < nameAttrs.length; ++i) {
            var element = nameAttrs[i];
            element.value = data[element.getAttribute('name')];
        }
    }
    exports.populate = populate;
});
"use strict";

jsns.define("htmlrest.formlifecycle", [
    "htmlrest.toggles",
    "htmlrest.rest"
],
function(exports, module, toggles, rest){

    /**
     * Create a simple ajax lifecyle for the form. This will show a loading screen
     * when fetching data and provides provisions to handle a data connection failure.
     * If your html uses the default bindings you don't need to pass settings.
     * @constructor
     * @param {htmlrest.component.BindingCollection} bindings - The bindings to use to lookup elements
     * @param {htmlrest.form.AjaxLifecycleSettings} [settings] - The settings for the form, optional
     */
    function FormLifecycle(bindings) {
        var tryAgainFunc = null;
        var self = this;

        bindings.setListener({
            submit: function (evt) {
                evt.preventDefault();
                self.submit();
            },
            tryAgain: function (evt) {
                evt.preventDefault();
                tryAgainFunc();
            }
        });

        var load = bindings.getToggle('load');
        var main = bindings.getToggle('main');
        var fail = bindings.getToggle('fail');
        var formToggler = new toggles.Group(load, main, fail);

        var settingsModel = bindings.getModel('settings');

        this.populate = function () {
            formToggler.show(load);
            rest.get(settingsModel.getSrc(),
                function (successData) {
                    settingsModel.setData(successData);
                    formToggler.show(main);
                },
                function (failData) {
                    tryAgainFunc = self.populate;
                    formToggler.show(fail);
                });
        }

        this.submit = function() {
            formToggler.show(load);
            var data = settingsModel.getData();
            rest.post(settingsModel.getSrc(), data,
                function (successData) {
                    formToggler.show(main);
                },
                function (failData) {
                    tryAgainFunc = self.submit;
                    formToggler.show(fail);
                });
        }
    }
    module.exports = FormLifecycle;
});
"use strict";

/**
 * @callback htmlrest_iter_cb
 */

/**
 * @callback htmlrest_iter
 * @param {array} items - the items to iterate
 * @param {htmlrest_iter_cb} - the function to transform each object
 * @returns the transformed item and null when all items are iterated
 *
 * Iter defines a function that will return a function that iterates
 * over a collection. An iterator here is a single function with no argument
 * that returns null when its work is complete. This matches functions as data
 * used elsewhere. This makes an easy way to transform data before displaying it
 * by calling iter on the collection and then returning what you want from the callback.
 * 
 * You don't new this just call it e.g. iter(things, function(thing){ return thing + ' changes' });
 */
jsns.define("htmlrest.iter", null,
function(exports, module){

    /**
     * Iterate over a collection of items calling cb for each one.
     * @param {array} items
     * @param {htmlrest_iter_cb} cb
     * @returns - The transformed item and null when all items are iterated.
     */
    function iter(items, cb) {
        var i = 0;
        return function () {
            if (i < items.length) {
                return cb(items[i++]);
            }
            return null;
        }
    }

    module.exports = iter;
});
"use strict";

jsns.define("htmlrest.models", [
    "htmlrest.form",
    "htmlrest.textstream",
    "htmlrest.components",
    "htmlrest.typeidentifiers",
    "htmlrest.domquery"
],
function(exports, module, forms, TextStream, components, typeId, domQuery){

    function FormModel(form, src) {
        this.setData = function (data) {
            forms.populate(form, data);
        }

        this.appendData = this.setData;

        this.getData = function () {
            return forms.serialize(form);
        }

        this.getSrc = function () {
            return src;
        }
    }

    function ComponentModel(element, src, component) {
        this.setData = function (data, createdCallback) {
            components.empty(element);
            this.appendData(data, createdCallback);
        }

        this.appendData = function (data, createdCallback) {
            if (typeId.isArray(data) || typeId.isFunction(data)) {
                components.repeat(component, element, data, createdCallback);
            }
            else if (data) {
                components.single(component, element, data, createdCallback);
            }
        }

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
        if (element.nodeName === 'FORM') {
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
"use strict";

jsns.define("htmlrest.rest", null,
function(exports, module){
    //Helper function to handle results
    function handleResult(xhr, success, fail) {
        if (xhr.status === 200) {
            if (success !== undefined) {
                var data = undefined;
                try {
                    data = JSON.parse(xhr.response);
                }
                catch (err) {
                    data = xhr.response;
                }
                success(data);
            }
        }
        else {
            if (fail !== undefined) {
                try {
                    data = JSON.parse(xhr.response);
                }
                catch (err) {
                    data = xhr.response;
                }
                fail(data);
            }
        }
    }

    /**
     * This callback is called when server communication has occured.
     * @callback exports~resultCallback
     * @param {object} data - The data result from the server.
     */

    /**
     * Post data to a url. Success and fail called depending on result
     * @param {string} url - The url to post to
     * @param {object} data - The data to post
     * @param {exports~resultCallback} success - Called if the operation is successful
     * @param {exports~resultCallback} [fail] - Called if the operation fails, if not provided will call success for this.
     */
    function post(url, data, success, fail) {
        ajax(url, 'POST', data, success, fail);
    }
    exports.post = post;

    /**
     * Put data to a url. Success and fail called depending on result
     * @param {string} url - The url to put to
     * @param {object} data - The data to put
     * @param {exports~resultCallback} success - Called if the operation is successful
     * @param {exports~resultCallback} [fail] - Called if the operation fails, if not provided will call success for this.
     */
    function put(url, data, success, fail) {
        ajax(url, 'PUT', data, success, fail);
    }
    exports.put = put;

    /**
     * Delete data at a url. Success and fail called depending on result
     * @param {string} url - The url to delete to
     * @param {object} data - Data to include
     * @param {exports~resultCallback} success - Called if the operation is successful
     * @param {exports~resultCallback} [fail] - Called if the operation fails, if not provided will call success for this.
     */
    function del(url, data, success, fail) {
        ajax(url, 'DELETE', data, success, fail);
    }
    exports.delete = del;

    /**
     * Get data from a url. Success and fail called depending on result
     * @param {string} url - The url to get data from
     * @param {exports~resultCallback} success - Called if the operation is successful
     * @param {exports~resultCallback} [fail] - Called if the operation fails, if not provided will call success for this.
     * @param {type} [cache=false] - True to use cached results, false to always get, default false.
     */
    function get(url, success, fail, cache) {
        if (fail === undefined) {
            fail = success;
        }
        if (cache === undefined || cache === false) {
            if (url.indexOf('?') > -1) {
                url += '&';
            }
            else {
                url += '?';
            }
            url += 'noCache=' + new Date().getTime();
        }

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onload = function () {
            handleResult(xhr, success, fail);
        };
        xhr.send();
    }
    exports.get = get;

    /**
     * A more raw ajax call if needed.
     * @param {string} url - The url to call
     * @param {string} method - The method to use
     * @param {object} data - The data to send
     * @param {exports~resultCallback} success - Called if the operation is successful
     * @param {exports~resultCallback} [fail] - Called if the operation fails, if not provided will call success for this.
     */
    function ajax(url, method, data, success, fail) {
        if (fail === undefined) {
            fail = success;
        }

        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () {
            handleResult(xhr, success, fail);
        };
        xhr.send(JSON.stringify(data));
    }
    exports.ajax = ajax;

    /**
     * Upload a file to a url
     * @param {string} url - The url to upload to
     * @param {object|FormData} data - The data to upload, if this is already form data it will be used directly, otherwise
     * data will be sent directly as a file.
     * @param {exports~resultCallback} success - Called if the operation is successful
     * @param {exports~resultCallback} [fail] - Called if the operation fails, if not provided will call success for this.
     */
    function upload(url, data, success, fail) {
        if (fail === undefined) {
            fail = success;
        }

        var formData = null;

        if (data instanceof FormData) {
            formData = data;
        }
        else {
            formData = new FormData();
            formData.append('file', data);
        }

        var xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.onload = function () {
            handleResult(xhr, success, fail);
        };
        xhr.send(formData);
    }
    exports.upload = upload;
});
"use strict";

jsns.define("htmlrest.storage", null,
function(exports, module){
    //The instance storage, 
    var instanceStorage = {};

    /**
    * @description Get the sesssion data, can specify a default value.
    * @param {string} name The name of the data to recover
    * @param {object} defaultValue, if not supplied is null
    * @return {object} The recovered object
    */
    function getSessionJson(name, defaultValue) {
        if (defaultValue === undefined) {
            defaultValue = null;
        }

        var recovered = sessionStorage.getItem(name);
        if (recovered !== null) {
            recovered = JSON.parse(recovered);
        }
        else {
            recovered = defaultValue;
        }
        return recovered;
    }
    exports.getSessionJson = getSessionJson;

    /**
    * @description Get the sesssion data, can specify a default value.
    * @param {string} name The name of the data to store
    * @param {object} value, if not supplied is null
    */
    function storeJsonInSession(name, value) {
        sessionStorage.setItem(name, JSON.stringify(value));
    }
    exports.storeJsonInSession = storeJsonInSession;

    /**
    * @description Get the instance data, can specify a default value.
    * If the value is not found and is given, the default value will be 
    * added to the instance storage.
    *
    * Instance storage is destroyed each page load
    * @param {string} name The name of the data to store
    * @param {object} value, if not supplied is null
    */
    function getInInstance(name, value) {
        if (instanceStorage.hasOwnProperty(name)) {
            return instanceStorage[name];
        }
        else {
            if (value !== undefined) {
                this.storeInInstance(name, value);
            }
            return value;
        }
    }
    exports.getInInstance = getInInstance;

    /**
    * @description Get the instance data, can specify a default value.
    * @param {string} name The name of the data to store
    * @param {object} value, if not supplied is null
    */
    function storeInInstance(name, value) {
        instanceStorage[name] = value;
    }
    exports.storeInInstance = storeInInstance;
});
"use strict";

jsns.define("htmlrest.textstream", [
    "htmlrest.escape"
],
function(exports, module, escape){

    function TextNode(str) {
        this.write = function (data) {
            return str;
        }
    }

    function VariableNode(variable) {
        this.write = function (data) {
            if (data) {
                return escape(data[variable]);
            }
            return "";
        }
    }

    function ThisVariableNode() {
        this.write = function (data) {
            if (data) {
                return escape(data);
            }
            return "";
        }
    }

    function format(data, streamNodes) {
        var text = "";
        for (var i = 0; i < streamNodes.length; ++i) {
            text += streamNodes[i].write(data);
        }
        return text;
    }

    /**
     * Create a text stream that when called with data will output
     * the original string with new data filled out. If the text contains
     * no variables no stream will be created.
     * @param {type} text
     * @param {type} alwaysCreate
     * @returns {type} 
     */
    function TextStream(text) {
        var streamNodes = [];
        var foundVariable = false;

        var textStart = 0;
        var bracketStart = 0;
        var bracketEnd = 0;
        for (var i = 0; i < text.length; ++i) {
            switch (text[i]) {
                case '{':
                    if (text[i + 1] !== '{') {
                        bracketStart = i;
                    }
                    break;
                case '}':
                    if (i + 1 === text.length || text[i + 1] !== '}') {
                        bracketEnd = i;

                        if (bracketStart < bracketEnd - 1) {
                            streamNodes.push(new TextNode(text.substring(textStart, bracketStart)));
                            var variableName = text.substring(bracketStart + 1, bracketEnd);
                            if (variableName === "this") {
                                streamNodes.push(new ThisVariableNode());
                            }
                            else {
                                streamNodes.push(new VariableNode(variableName));
                            }
                            textStart = i + 1;
                            foundVariable = true;
                        }
                    }
                    break;
            }
        }

        if (textStart < text.length) {
            streamNodes.push(new TextNode(text.substring(textStart, text.length)));
        }

        this.format = function (data) {
            return format(data, streamNodes);
        }

        this.foundVariable = function () {
            return foundVariable;
        }
    }
    module.exports = TextStream;
});
"use strict";

jsns.define("htmlrest.toggles", [
    "htmlrest.typeidentifiers"
],
function(exports, module, typeId){

    var togglePlugins = [];

    /**
     * Add a toggle plugin that can create additional items on the toggle chain.
     * @param {type} plugin
     */
    function addTogglePlugin(plugin) {
        togglePlugins.push(plugin);
    }
    exports.addTogglePlugin = addTogglePlugin;

    /**
     * A simple toggler that does nothing. Used to shim correctly if no toggles are defined for a toggle element.
     */
    function NullToggle(next) {
        this.on = function () {
            if (next) {
                next.on();
            }
        }

        this.off = function () {
            if (next) {
                next.off();
            }
        }
    }
    exports.NullToggle = NullToggle;

    /**
     * A toggler that toggles style for an element
     */
    function StyleToggle(element, onStyle, offStyle, next) {
        onStyle = onStyle || "";
        offStyle = offStyle || "";

        var originalStyles = element.style.cssText || "";

        this.on = function () {
            element.style.cssText = originalStyles + onStyle;
            if (next) {
                next.on();
            }
        }

        this.off = function () {
            element.style.cssText = originalStyles + offStyle;
            if (next) {
                next.off();
            }
        }
    }

    /**
     * A toggler that toggles classes for an element
     */
    function ClassToggle(element, onClass, offClass, idleClass, next) {
        onClass = onClass || "";
        offClass = offClass || "";

        var originalClasses = element.getAttribute("class") || "";

        this.on = function () {
            element.setAttribute("class", originalClasses + ' ' + onClass);
            startAnimation();
            if (next) {
                next.on();
            }
        }

        this.off = function () {
            element.setAttribute("class", originalClasses + ' ' + offClass);
            startAnimation();
            if (next) {
                next.off();
            }
        }

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

    function Group() {
        var toggles = arguments;

        this.add = function (toggle) {
            toggles.push(toggle);
        }

        this.show = function (toggle) {
            for (var i = 0; i < toggles.length; ++i) {
                toggles[i].off();
            }
            toggle.on();
        }
    }
    exports.Group = Group;

    function build(element) {
        //Not many of these so just search for everything
        var onStyle = element.getAttribute('data-hr-style-on');
        var offStyle = element.getAttribute('data-hr-style-off');
        var onClass = element.getAttribute('data-hr-class-on');
        var offClass = element.getAttribute('data-hr-class-off');
        var idleClass = element.getAttribute('data-hr-class-idle');
        var toggle = null;

        if (onStyle || offStyle) {
            toggle = new StyleToggle(element, onStyle, offStyle, toggle);
        }

        if (onClass || offClass) {
            toggle = new ClassToggle(element, onClass, offClass, idleClass, toggle);
        }

        //Now toggle plugin chain
        for (var i = 0; i < togglePlugins.length; ++i) {
            toggle = togglePlugins[i](element, toggle);
        }

        //If we get all the way here with no toggle, use the null toggle.
        if (toggle === null) {
            toggle = new NullToggle(toggle);
        }

        return toggle;
    }
    exports.build = build;

    /**
     * Determine if a given toggle is a null toggle.
     * @param toggle - the toggle to check
     * @returns {type} - True if toggle is a NullToggle
     */
    function isNullToggle(toggle) {
        return typeId.isObject(toggle) && typeId.constructor.prototype == NullToggle.prototype;
    }
    exports.isNullToggle = isNullToggle;
});
"use strict";

jsns.define("htmlrest.typeidentifiers", null,
function(exports, module){
    //only implement if no native implementation is available
    if (typeof Array.isArray === 'undefined') {
        Array.isArray = function (obj) {
            return Object.prototype.toString.call(obj) === '[object Array]';
        }
    };

    /**
     * Determine if a variable is an array.
     * @param test - The object to test
     * @returns {boolean} - True if the object is an array
     */
    function isArray(test){
        return Array.isArray(test);
    }
    exports.isArray = isArray;

    /**
     * Determine if a variable is a string.
     * @param test - The object to test
     * @returns {boolean} - True if a string, false if not
     */
    function isString(test) {
        return typeof (test) === 'string';
    }
    exports.isString = isString;

    /**
     * Determine if a variable is a function.
     * @param test - The object to test
     * @returns {boolean} - True if a function, false if not
     */
    function isFunction(test) {
        return typeof (test) === 'function';
    }
    exports.isFunction = isFunction;

    /**
     * Determine if a variable is an object.
     * @param test - The object to test
     * @returns {boolean} - True if an object, false if not
     */
    function isObject(test) {
        return typeof data === 'object';
    }
    exports.isObject = isObject;
});


"use strict";

jsns.run([
    "htmlrest.toggles"
],
function(exports, module, toggles){

    function ModalToggle(element, next) {
        var modal = new Modal(element);

        this.on = function () {
            modal.open();
            if (next) {
                next.on();
            }
        }

        this.off = function () {
            modal.close();
            if (next) {
                next.off();
            }
        }
    }

    toggles.addTogglePlugin(function (element, toggle) {
        if (element.classList.contains('modal')) {
            toggle = new ModalToggle(element, toggle);
        }

        return toggle;
    });
});
//# sourceMappingURL=htmlrest.js.map
