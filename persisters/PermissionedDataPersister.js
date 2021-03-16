"use strict";
var Defer = require("ts-promises/Defer");
/** DataPersister wrapper that checks permissions before reading/writing data
 * @author TeamworkGuy2
 */
var PermissionedDataPersisterAdapter = /** @class */ (function () {
    function PermissionedDataPersisterAdapter(persister, syncSettings, storeSettings) {
        this.syncSettings = syncSettings;
        this.storeSettings = storeSettings;
        this.persister = persister;
    }
    PermissionedDataPersisterAdapter.prototype.getCollectionNames = function () {
        if (this.syncSettings.readAllow) {
            return this.persister.getCollectionNames();
        }
        else {
            var dfd = Defer.newDefer();
            dfd.reject("permission denied: data persister read permissions are denied");
            return dfd.promise;
        }
    };
    PermissionedDataPersisterAdapter.prototype.persist = function () {
        if (this.syncSettings.writeAllow) {
            return this.persister.persist({ compress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Defer.newDefer();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    };
    PermissionedDataPersisterAdapter.prototype.restore = function () {
        if (this.syncSettings.readAllow) {
            return this.persister.restore({ decompress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Defer.newDefer();
            dfd.reject("permission denied: data persister read permissions are denied");
            return dfd.promise;
        }
    };
    PermissionedDataPersisterAdapter.prototype.getCollectionRecords = function (collectionName, options) {
        if (this.syncSettings.readAllow) {
            return this.persister.getCollectionRecords(collectionName, { decompress: (options != null ? options.decompress : this.storeSettings.compressLocalStores) });
        }
        else {
            var dfd = Defer.newDefer();
            dfd.reject("permission denied: data persister read permissions are denied");
            return dfd.promise;
        }
    };
    PermissionedDataPersisterAdapter.prototype.addCollectionRecords = function (collectionName, options, records, removeExisting) {
        if (this.syncSettings.writeAllow) {
            return this.persister.addCollectionRecords(collectionName, {
                compress: (options != null ? options.compress : this.storeSettings.compressLocalStores),
                maxObjectsPerChunk: (options != null ? options.maxObjectsPerChunk : null)
            }, records, removeExisting);
        }
        else {
            var dfd = Defer.newDefer();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    };
    PermissionedDataPersisterAdapter.prototype.clearCollections = function (collectionNames) {
        if (this.syncSettings.writeAllow) {
            return this.persister.clearCollections(collectionNames);
        }
        else {
            var dfd = Defer.newDefer();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    };
    PermissionedDataPersisterAdapter.prototype.clearPersistentDb = function () {
        if (this.syncSettings.writeAllow) {
            return this.persister.clearPersistentDb();
        }
        else {
            var dfd = Defer.newDefer();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    };
    return PermissionedDataPersisterAdapter;
}());
module.exports = PermissionedDataPersisterAdapter;
