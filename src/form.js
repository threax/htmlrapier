﻿//Form Functions
htmlrest.event.prototype.form = function () { }

htmlrest.event.prototype.form.prototype.serialize = function (form) {
    return function (evt, sender, previousResult, runner) {
        htmlrest.event.prototype.form.prototype.serialize.prototype.serializeRunner(form, evt, sender, previousResult, runner);
    }
}

htmlrest.event.prototype.form.prototype.serializeSelf = function () {
    return function (evt, sender, previousResult, runner) {
        htmlrest.event.prototype.form.prototype.serialize.prototype.serializeRunner(sender, evt, sender, previousResult, runner);
    }
}

htmlrest.event.prototype.form.prototype.serialize.prototype.serializeRunner = function (form, evt, sender, previousResult, runner) {
    runner.next(form.serialize());
}

htmlrest.event.prototype.form.prototype.submit = function (form) {
    return function (evt, sender, previousResult, runner) {
        htmlrest.event.prototype.form.prototype.submit.prototype.runner(form, evt, sender, previousResult, runner);
    }
}

htmlrest.event.prototype.form.prototype.submitSelf = function () {
    return function (evt, sender, previousResult, runner) {
        htmlrest.event.prototype.form.prototype.submit.prototype.runner(sender, evt, sender, previousResult, runner);
    }
}

htmlrest.event.prototype.form.prototype.submit.prototype.runner = function (form, evt, sender, previousResult, runner) {
    $.ajax({
        method: form.attr('method'),
        url: form.attr('action'),
        data: previousResult,
        success: function (data, textStatus, jqXHR) {
            runner.next({ data: data, jqHHR: jqXHR });
        },
        error: function (jqXHR, textStatus, errorThrown) {
            runner.next({ data: jqXHR.data, jqHHR: jqXHR });
        }
    });
}

htmlrest.form = new htmlrest.event.prototype.form();