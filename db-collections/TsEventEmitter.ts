
/** TsEventEmitter is a minimalist version of EventEmitter.
 * It manages a map associating event names and arrays of event listeners, as well as emitting events and triggering
 * listeners that have been added to the event through the on(event, callback) method
 */
class EventEmitter<T extends { [eventName: string]: any[] }> implements TsEventEmitter<T> {
    /** @prop Events property is a hashmap, with each property being an array of callbacks
     */
    events: T;


    constructor(events?: T) {
        this.events = events || <T>{};
    }


    /** adds a listener to the queue of callbacks associated to an event
     * @returns the index of the callback in the array of listeners for a particular event
     */
    public on(eventName: keyof T, listener: (...args: any[]) => void): (...args: any[]) => void {
        var event = this.events[eventName];
        if (event == null) {
            event = this.events[eventName] = <any>[];
        }
        event.push(listener);
        return listener;
    }


    /** removes the listener at position 'index' from the event 'eventName'
     */
    public removeListener(eventName: keyof T, listener: (...args: any[]) => void) {
        if (this.events[eventName]) {
            var listeners = this.events[eventName];
            listeners.splice(listeners.indexOf(listener), 1);
        }
    }


    /** emits a particular event
     * with the option of passing optional parameters which are going to be processed by the callback
     * provided signatures match (i.e. if passing emit(event, arg0, arg1) the listener should take two parameters)
     * @param eventName - the name of the event
     * @param data - optional object passed with the event
     */
    public emit(eventName: keyof T, data?: any) {
        if (!eventName || !this.events[eventName]) {
            throw new Error("No event " + eventName + " defined");
        }

        var ls = this.events[eventName];
        for (var i = 0, cnt = ls.length; i < cnt; i++) {
            ls[i](data);
        }
    }

}

export = EventEmitter;