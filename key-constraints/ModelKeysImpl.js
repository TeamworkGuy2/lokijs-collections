"use strict";
/** ModelKeys - helper for primary keys from a ModelDefinitions
 * For managing the primary and auto-generated keys from a data model
 * @author TeamworkGuy2
 */
var ModelKeysImpl = (function () {
    function ModelKeysImpl(modelDefs) {
        this.modelDefs = modelDefs;
    }
    /** add missing IDs that should be auto-generated
     * @param autoGenKeys: in the format { name: "...", largestKey: 45678 }
     */
    ModelKeysImpl.prototype.addGeneratedIds = function (autoGenKeys, doc) {
        for (var i = 0, size = autoGenKeys.length; i < size; i++) {
            var agKeyI = autoGenKeys[i];
            // increment the largest key and use it as the new key
            agKeyI.largestKey = (agKeyI.largestKey || 0) + 1;
            var newId = agKeyI.largestKey;
            doc[agKeyI.name] = newId;
        }
    };
    /** track auto-generated IDs
     * @param autoGenKeys: in the format { name: "...", largestKey: 45678 }
     */
    ModelKeysImpl.prototype.trackGeneratedIds = function (autoGenKeys, doc) {
        for (var i = 0, size = autoGenKeys.length; i < size; i++) {
            var agKeyI = autoGenKeys[i];
            // track the largest key and use it as the latest unique ID key
            agKeyI.largestKey = Math.max(agKeyI.largestKey, doc[agKeyI.name]);
        }
    };
    ModelKeysImpl.prototype.validateQuery = function (collectionName, query, obj) {
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
    };
    return ModelKeysImpl;
}());
(function (ModelKeysImpl) {
    /** Constrains the value of a field
     */
    var Constraint = (function () {
        function Constraint(id) {
            this.id = id;
        }
        Constraint.NON_NULL = new Constraint(1);
        Constraint.UNIQUE = new Constraint(2);
        return Constraint;
    }());
    ModelKeysImpl.Constraint = Constraint;
    /** How to handle auto generated fields (i.e. primary keys)
     */
    var Generated = (function () {
        function Generated(id) {
            this.id = id;
        }
        Generated.AUTO_GENERATE = new Generated(1);
        Generated.PRESERVE_EXISTING = new Generated(2);
        return Generated;
    }());
    ModelKeysImpl.Generated = Generated;
})(ModelKeysImpl || (ModelKeysImpl = {}));
module.exports = ModelKeysImpl;
