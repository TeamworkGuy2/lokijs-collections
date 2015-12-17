
/** ModelKeys - helper for primary keys from a {@link ModelDefinitions}
 * For managing the primary and auto-generated keys from a data model
 * @author TeamworkGuy2
 */
class ModelKeysImpl implements ModelKeys {
    modelDefs: ModelDefinitions;


    constructor(modelDefs: ModelDefinitions) {
        this.modelDefs = modelDefs;
    }


    /** add missing IDs that should be auto-generated
     * @param {Array} autoGenKeys: in the format { name: "...", largestKey: 45678 }
     */
    public addGeneratedIds(autoGenKeys: { name: string; largestKey: number }[], doc): void {
        for (var i = 0, size = autoGenKeys.length; i < size; i++) {
            var agKeyI = autoGenKeys[i];
            // increment the largest key and use it as the new key
            agKeyI.largestKey = (agKeyI.largestKey || 0) + 1;
            var newId = agKeyI.largestKey;
            doc[agKeyI.name] = newId;
        }
    }


    /** track auto-generated IDs
     * @param {Array} autoGenKeys: in the format { name: "...", largestKey: 45678 }
     */
    public trackGeneratedIds(autoGenKeys: { name: string; largestKey: number }[], doc): void {
        for (var i = 0, size = autoGenKeys.length; i < size; i++) {
            var agKeyI = autoGenKeys[i];
            // track the largest key and use it as the latest unique ID key
            agKeyI.largestKey = Math.max(agKeyI.largestKey, doc[agKeyI.name]);
        }
    }


    public validateQuery(collectionName: string, query: any, obj: any): any {
        //Allow empty query to automatically query by Id;
        if (!query) {
            query = {};
            var idNames = this.modelDefs.getPrimaryKeyNames(collectionName);
            if (idNames.length <= 0) {
                throw new Error("Can't call updateWhere without a where clause on collection " + collectionName + " which has no uniqueId.");
            }

            for (var i = 0, size = idNames.length; i < size; i++) {
                var idFieldName = idNames[i];
                var queryValue = obj[idFieldName];
                if (!queryValue) {
                    throw new Error("You can only update one row by calling addOrUpdateWhere without a where clause. Make sure update object has values for the uniqueId's of collection " + collectionName);
                }
                query[idFieldName] = queryValue;
            }
        }
        return query;
    }

}


module ModelKeysImpl {

    /** Constrains the value of a field
     */
    export class Constraint {
        public static NON_NULL = new Constraint(1);
        public static UNIQUE = new Constraint(2);

        private id: number;

        constructor(id: number) {
            this.id = id;
        }
    }


    /** How to handle auto generated fields (i.e. primary keys)
     */
    export class Generated {
        public static AUTO_GENERATE = new Generated(1);
        public static PRESERVE_EXISTING = new Generated(2);

        private id: number;

        constructor(id: number) {
            this.id = id;
        }
    }
}

export = ModelKeysImpl;
