import Arrays = require("ts-mortar/utils/Arrays");
import Objects = require("ts-mortar/utils/Objects");

module CloneUtil {

    /** Clone an object and remove lokijs meta-data using a for-in loop with an if-statement to assign the properties to the new object excluding '$loki' and 'meta'
     * @param obj the object to copy
     * @param cloneDeep optional (default: 'Objects.clone') boolean or function to control whether a shallow copy of the object's properties or a deep copy is created
     */
    export function cloneForInIf(obj: any, cloneDeep ?: boolean | ((obj: any) => any)): any {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? echo : cloneDeep != null ? <(obj: any) => any>cloneDeep : echo);

        var copy: any = {};
        for (var key in obj) {
            if (key !== "$loki" && key !== "meta") {
                copy[key] = cloneFunc(obj[key]);
            }
        }
        return copy;
    }


    /** Clone an object and remove lokijs meta-data using 'Object.keys()' and a for-loop with an if-statement to assign the properties to the new object excluding '$loki' and 'meta'
     * @param obj the object to copy
     * @param cloneDeep optional (default: 'Objects.clone') boolean or function to control whether a shallow copy of the object's properties or a deep copy is created
     */
    export function cloneKeysForIf(obj: any, cloneDeep ?: boolean | ((obj: any) => any)): any {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? echo : cloneDeep != null ? <(obj: any) => any>cloneDeep : echo);

        var copy: any = {};
        var keys = <string[]>Object.keys(obj);
        for (var i = 0, size = keys.length; i < size; i++) {
            var key = keys[i];
            if (key !== "$loki" && key !== "meta") {
                copy[key] = cloneFunc(obj[key]);
            }
        }
        return copy;
    }


    /** Clone an object and remove lokijs meta-data using 'Object.keys()', removing '$loki' and 'meta' from the keys and a for-loop to assign the properties to the new object
     * @param obj the object to copy
     * @param cloneDeep optional (default: 'Objects.clone') boolean or function to control whether a shallow copy of the object's properties or a deep copy is created
     */
    export function cloneKeysExcludingFor(obj: any, cloneDeep ?: boolean | ((obj: any) => any)): any {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? echo : cloneDeep != null ? <(obj: any) => any>cloneDeep : echo);

        var copy: any = {};
        var keys = <string[]>Object.keys(obj);
        Arrays.fastRemove(keys, "$loki");
        Arrays.fastRemove(keys, "meta");
        for (var i = 0, size = keys.length; i < size; i++) {
            var key = keys[i];
            copy[key] = cloneFunc(obj[key]);
        }
        return copy;
    }


    /** Clone an object and remove lokijs meta-data using 'Objects.clone()' or 'Objects.cloneDeep()' or a custom clone function and then 'delete copy.$loki' and 'delete copy.meta'
     * @param obj the object to copy
     * @param cloneDeep optional (default: 'Objects.clone') boolean or function to control whether a shallow copy of the object's properties or a deep copy is created
     */
    export function cloneCloneDelete(obj: any, cloneDeep?: boolean | ((obj: any) => any)): any {
        var cloneFunc = cloneDeep === true ? Objects.cloneDeep : (cloneDeep === false ? Objects.clone : cloneDeep != null ? <(obj: any) => any>cloneDeep : Objects.clone);

        var copy = cloneFunc(obj);

        delete copy.$loki;
        delete copy.meta;

        return copy;
    }


    /** Clone an object and remove lokijs meta-data using 'JSON.parse(JSON.stringify())' and then 'delete copy.$loki' and 'delete copy.meta'
     * @param obj the object to copy
     */
    export function cloneParseStringify(obj: any): any {
        var copy = JSON.parse(JSON.stringify(obj));

        delete copy.$loki;
        delete copy.meta;

        return copy;
    }


    export function cloneDeepWithoutMetaData(obj: any, cloneDeep: (obj: any) => any = Objects.cloneDeep, type: CloneFunc): any {
        return type(obj, cloneDeep);
    }


    export function getCloneFunc(cloneType: CloneType): CloneFunc {
        var cloneFunc = <CloneFunc | null>(cloneType === "for-in-if" ? cloneForInIf :
            (cloneType === "keys-for-if" ? cloneKeysForIf :
                (cloneType === "keys-excluding-for" ? cloneKeysExcludingFor :
                    (cloneType === "clone-delete" ? cloneCloneDelete :
                        (cloneType === "parse-stringify" ? cloneParseStringify : null)))));

        if (cloneFunc == null) {
            throw new Error("cloneType '" + cloneType + "' is not a recognized clone type");
        }

        return cloneFunc;
    }


    function echo(value: any): any {
        return value;
    }

}

export = CloneUtil;