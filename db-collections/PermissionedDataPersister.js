"use strict";
/** {@link DataPersister.Adapter} wrapper that checks permissions before reading/writing data
 * @author TeamworkGuy2
 */
var PermissionedDataPersisterAdapter = (function () {
    function PermissionedDataPersisterAdapter(persister, syncSettings, storeSettings) {
        this.syncSettings = syncSettings;
        this.storeSettings = storeSettings;
        this.persister = persister;
    }
    PermissionedDataPersisterAdapter.prototype.persist = function () {
        if (this.syncSettings.writeAllow) {
            return this.persister.persist({ compress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Q.defer();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    };
    PermissionedDataPersisterAdapter.prototype.restore = function () {
        if (this.syncSettings.readAllow) {
            return this.persister.restore({ decompress: this.storeSettings.compressLocalStores });
        }
        else {
            var dfd = Q.defer();
            dfd.reject("permission denied: data persister read permissions are denied");
            return dfd.promise;
        }
    };
    PermissionedDataPersisterAdapter.prototype.clearPersistentDb = function () {
        if (this.syncSettings.writeAllow) {
            return this.persister.clearPersistentDb();
        }
        else {
            var dfd = Q.defer();
            dfd.reject("permission denied: data persister write permissions are denied");
            return dfd.promise;
        }
    };
    return PermissionedDataPersisterAdapter;
}());
module.exports = PermissionedDataPersisterAdapter;