///<amd-module name="hr.defaultform"/>

import * as component from 'hr.components';
import {ComponentBuilder, VariantBuilder} from 'hr.componentbuilder';

//Register default components
if(!component.isDefined("hr.defaultform")){
    var builder = new ComponentBuilder(
        '<div class="form-group"><label>{{title}}</label><input class="form-control" name="{{buildName}}" type="{{buildType}}"></div>'
    );
    builder.addVariant("checkbox", new VariantBuilder(
        '<div class="checkbox"><label><input type="checkbox" name="{{buildName}}">&nbsp;{{title}}</label></div>'
    ));
    builder.addVariant("select", new VariantBuilder(
        '<div class="form-group"><label>{{title}}</label><select class="form-control" name="{{buildName}}"/></div>'
    ));
    builder.addVariant("multiselect", new VariantBuilder(
        '<div class="form-group"><label>{{title}}</label><select class="form-control" name="{{buildName}}" multiple size="{{size}}"/></div>'
    ));
    builder.addVariant("arrayEditor", new VariantBuilder(
        '<div><label>{{title}}</label><div data-hr-view="items" data-hr-view-component="hr.defaultform-arrayEditorItem"></div><button data-hr-on-click="add">Add</button></div>'
    ));
    component.register("hr.defaultform", builder.getFactory());

    var arrayEditorItem = new ComponentBuilder(
        '<div data-hr-handle="item"></div><button data-hr-on-click="remove">Remove</button>'
    );
    component.register("hr.defaultform-arrayEditorItem", arrayEditorItem.getFactory());
}