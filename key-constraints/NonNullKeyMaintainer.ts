/** Check that a collection of objects have non null values for certain keys
 * @author TeamworkGuy2
 */
class NonNullKeyMaintainer {
    private modelKeys: ModelKeys;


    constructor(modelKeys: ModelKeys) {
        this.modelKeys = modelKeys;
    }


    /** Check for null or missing required properties in an array of documents
     * @param throwErrorIfNull: true causes an error to be thrown when the first document with a null key that should
     * not be null is encountered, false to return the documents sorted into valid and invalid arrays
     * @return only returns if 'throwErrorIfNull' is false, returns an object with 'valid' and 'invalid' arrays
     * containing the valid and invalid items from the 'docs' parameter
     */
    public manageKeys<T>(collectionName: string, docs: T[], throwErrorIfNull: boolean) {
        //Ensure a legacy uniqueId field is present
        var keyNames = this.modelKeys.modelDefs.getPrimaryKeyNames(collectionName);
        if (keyNames.length > 0) {
            if (throwErrorIfNull) {
                for (var i = 0, size = docs.length; i < size; i++) {
                    var doc = docs[i];
                    for (var ii = 0, sizeI = keyNames.length; ii < sizeI; ii++) {
                        if (doc[keyNames[ii]] == null) {
                            throw new Error("Attempting to insert object into " + collectionName + " without valid unique keys: [" + keyNames + "]");
                        }
                    }
                }
            }
            else {
                var validAry: T[] = [];
                var invalidAry: T[] = [];
                var res = { valid: validAry, invalid: invalidAry };

                for (var i = 0, size = docs.length; i < size; i++) {
                    var doc = docs[i];
                    var valid = true;
                    for (var ii = 0, sizeI = keyNames.length; ii < sizeI; ii++) {
                        if (doc[keyNames[ii]] == null) {
                            valid = false;
                            break;
                        }
                    }
                    if (valid) {
                        res.valid.push(doc);
                    }
                    else {
                        res.invalid.push(doc);
                    }
                }
                return res;
            }
        }
    }

}

export = NonNullKeyMaintainer;
