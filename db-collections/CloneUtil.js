"use strict";
var Arrays = require("ts-mortar/utils/Arrays");
var Objects = require("ts-mortar/utils/Objects");
var CloneUtil;
(function (CloneUtil) {
    /** Clone an object and remove lokijs meta-data using a for-in loop with an if-statement to assign the properties to the new object excluding '$loki' and 'meta'
     * @param obj the object to copy
     * @param cloneDeep optional (default: 'Objects.clone') boolean or function to control whether a shallow copy of the object's properties or a deep copy is created
     */
    function cloneForInIf(obj, cloneDeep) {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? echo : cloneDeep != null ? cloneDeep : echo);
        var copy = {};
        for (var key in obj) {
            if (key !== "$loki" && key !== "meta") {
                copy[key] = cloneFunc(obj[key]);
            }
        }
        return copy;
    }
    CloneUtil.cloneForInIf = cloneForInIf;
    /** Clone an object and remove lokijs meta-data using 'Object.keys()' and a for-loop with an if-statement to assign the properties to the new object excluding '$loki' and 'meta'
     * @param obj the object to copy
     * @param cloneDeep optional (default: 'Objects.clone') boolean or function to control whether a shallow copy of the object's properties or a deep copy is created
     */
    function cloneKeysForIf(obj, cloneDeep) {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? echo : cloneDeep != null ? cloneDeep : echo);
        var copy = {};
        var keys = Object.keys(obj);
        for (var i = 0, size = keys.length; i < size; i++) {
            var key = keys[i];
            if (key !== "$loki" && key !== "meta") {
                copy[key] = cloneFunc(obj[key]);
            }
        }
        return copy;
    }
    CloneUtil.cloneKeysForIf = cloneKeysForIf;
    /** Clone an object and remove lokijs meta-data using 'Object.keys()', removing '$loki' and 'meta' from the keys and a for-loop to assign the properties to the new object
     * @param obj the object to copy
     * @param cloneDeep optional (default: 'Objects.clone') boolean or function to control whether a shallow copy of the object's properties or a deep copy is created
     */
    function cloneKeysExcludingFor(obj, cloneDeep) {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? echo : cloneDeep != null ? cloneDeep : echo);
        var copy = {};
        var keys = Object.keys(obj);
        Arrays.fastRemove(keys, "$loki");
        Arrays.fastRemove(keys, "meta");
        for (var i = 0, size = keys.length; i < size; i++) {
            var key = keys[i];
            copy[key] = cloneFunc(obj[key]);
        }
        return copy;
    }
    CloneUtil.cloneKeysExcludingFor = cloneKeysExcludingFor;
    /** Clone an object and remove lokijs meta-data using 'Objects.clone()' or 'Objects.cloneDeep()' or a custom clone function and then 'delete copy.$loki' and 'delete copy.meta'
     * @param obj the object to copy
     * @param cloneDeep optional (default: 'Objects.clone') boolean or function to control whether a shallow copy of the object's properties or a deep copy is created
     */
    function cloneCloneDelete(obj, cloneDeep) {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? cloneDeep : Objects.clone);
        var copy = cloneFunc(obj);
        delete copy.$loki;
        delete copy.meta;
        return copy;
    }
    CloneUtil.cloneCloneDelete = cloneCloneDelete;
    /** Clone an object and remove lokijs meta-data using 'JSON.parse(JSON.stringify())' and then 'delete copy.$loki' and 'delete copy.meta'
     * @param obj the object to copy
     */
    function cloneParseStringify(obj) {
        var copy = JSON.parse(JSON.stringify(obj));
        delete copy.$loki;
        delete copy.meta;
        return copy;
    }
    CloneUtil.cloneParseStringify = cloneParseStringify;
    function cloneDeepWithoutMetaData(obj, cloneDeep, type) {
        if (cloneDeep === void 0) { cloneDeep = Objects.cloneDeep; }
        return type(obj, cloneDeep);
    }
    CloneUtil.cloneDeepWithoutMetaData = cloneDeepWithoutMetaData;
    function getCloneFunc(cloneType) {
        var cloneFunc = (cloneType === "for-in-if" ? cloneForInIf :
            (cloneType === "keys-for-if" ? cloneKeysForIf :
                (cloneType === "keys-excluding-for" ? cloneKeysExcludingFor :
                    (cloneType === "clone-delete" ? cloneCloneDelete :
                        (cloneType === "parse-stringify" ? cloneParseStringify : null)))));
        if (cloneFunc == null) {
            throw new Error("cloneType '" + cloneType + "' is not a recognized clone type");
        }
        return cloneFunc;
    }
    CloneUtil.getCloneFunc = getCloneFunc;
    function echo(value) {
        return value;
    }
})(CloneUtil || (CloneUtil = {}));
module.exports = CloneUtil;
