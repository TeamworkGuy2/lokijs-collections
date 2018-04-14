/** Check that a collection of objects have non null values for certain keys
 * @author TeamworkGuy2
 */
class NonNullKeyMaintainer {
    private modelDefs: ModelDefinitions;


    constructor(modelDefs: ModelDefinitions) {
        this.modelDefs = modelDefs;
    }


    /** Check for null or missing required properties in an array of documents
     * @param throwErrorIfNull: true causes an error to be thrown when the first document with a null key that should
     * not be null is encountered, false to return the documents sorted into valid and invalid arrays
     * @return only returns if 'throwErrorIfNull' is false, returns an object with 'valid' and 'invalid' arrays
     * containing the valid and invalid items from the 'docs' parameter
     */
    public manageKeys<T>(collectionName: string, docs: T[], throwErrorIfNull: boolean) {
        //Ensure a legacy uniqueId field is present
        var keyNames = this.modelDefs.getPrimaryKeys(collectionName);
        if (keyNames.length > 0) {
            if (throwErrorIfNull) {
                for (var i = 0, size = docs.length; i < size; i++) {
                    var doc = docs[i];
                    for (var ii = 0, sizeI = keyNames.length; ii < sizeI; ii++) {
                        if ((<any>doc)[keyNames[ii]] == null) {
                            throw new Error("Attempting to insert object into " + collectionName + " without valid unique keys: [" + keyNames + "]");
                        }
                    }
                }
            }
            else {
                var validAry: T[] = [];
                var invalidAry: T[] = [];

                for (var i = 0, size = docs.length; i < size; i++) {
                    var doc = docs[i];
                    var valid = true;
                    for (var ii = 0, sizeI = keyNames.length; ii < sizeI; ii++) {
                        if ((<any>doc)[keyNames[ii]] == null) {
                            valid = false;
                            break;
                        }
                    }
                    if (valid) {
                        validAry.push(doc);
                    }
                    else {
                        invalidAry.push(doc);
                    }
                }

                return {
                    valid: validAry,
                    invalid: invalidAry
                };
            }
        }
        return undefined;
    }

}

export = NonNullKeyMaintainer;
