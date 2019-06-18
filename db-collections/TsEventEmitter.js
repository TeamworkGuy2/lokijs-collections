"use strict";
/** TsEventEmitter is a minimalist version of EventEmitter.
 * It manages a map associating event names and arrays of event listeners, as well as emitting events and triggering
 * listeners that have been added to the event through the on(event, callback) method
 */
var EventEmitter = /** @class */ (function () {
    function EventEmitter(events) {
        this.events = events || {};
    }
    /** adds a listener to the queue of callbacks associated to an event
     * @returns the index of the callback in the array of listeners for a particular event
     */
    EventEmitter.prototype.on = function (eventName, listener) {
        var event = this.events[eventName];
        if (event == null) {
            event = this.events[eventName] = [];
        }
        event.push(listener);
        return listener;
    };
    /** removes the listener at position 'index' from the event 'eventName'
     */
    EventEmitter.prototype.removeListener = function (eventName, listener) {
        if (this.events[eventName]) {
            var listeners = this.events[eventName];
            listeners.splice(listeners.indexOf(listener), 1);
        }
    };
    /** emits a particular event
     * with the option of passing optional parameters which are going to be processed by the callback
     * provided signatures match (i.e. if passing emit(event, arg0, arg1) the listener should take two parameters)
     * @param eventName - the name of the event
     * @param data - optional object passed with the event
     */
    EventEmitter.prototype.emit = function (eventName, data) {
        if (!eventName || !this.events[eventName]) {
            throw new Error("No event " + eventName + " defined");
        }
        var ls = this.events[eventName];
        for (var i = 0, cnt = ls.length; i < cnt; i++) {
            ls[i](data);
        }
    };
    return EventEmitter;
}());
module.exports = EventEmitter;
