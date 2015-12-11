/// <reference path="./collection-changes.d.ts" />
/**
 * @author TeamworkGuy2
 */
var ChangeTrackersImpl;
(function (ChangeTrackersImpl) {
    /** A {@link CollectionChangeInfo} wrapper which simply adds to its existing 'added', 'modified', 'removed' values
     */
    var CompoundCollectionChange = (function () {
        function CompoundCollectionChange(changeInfo) {
            this.changeInfo = changeInfo || ChangeTracker.createChangeInfoObject(0, 0, 0);
        }
        Object.defineProperty(CompoundCollectionChange.prototype, "added", {
            get: function () { return this.changeInfo.added; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(CompoundCollectionChange.prototype, "modified", {
            get: function () { return this.changeInfo.modified; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(CompoundCollectionChange.prototype, "removed", {
            get: function () { return this.changeInfo.removed; },
            enumerable: true,
            configurable: true
        });
        CompoundCollectionChange.prototype.addChangeItemsAdded = function (items) {
            this.changeInfo.added += (items ? items.length || 1 : 0);
        };
        CompoundCollectionChange.prototype.addChangeItemsModified = function (items) {
            this.changeInfo.modified += (items ? items.length || 1 : 0);
        };
        CompoundCollectionChange.prototype.addChangeItemsRemoved = function (items) {
            this.changeInfo.removed += (items ? items.length || 1 : 0);
        };
        CompoundCollectionChange.prototype.addChange = function (change) {
            if (change == null) {
                return;
            }
            this.changeInfo.added += (!isNaN(change.added) ? change.added : 0);
            this.changeInfo.modified += (!isNaN(change.modified) ? change.modified : 0);
            this.changeInfo.removed += (!isNaN(change.removed) ? change.removed : 0);
        };
        return CompoundCollectionChange;
    })();
    ChangeTrackersImpl.CompoundCollectionChange = CompoundCollectionChange;
    /** Default {@link CollectionChangeInfo} implementation using a change history buffer with a maximum size
     */
    var ChangeTracker = (function () {
        function ChangeTracker(maxChangesTracked) {
            if (maxChangesTracked === void 0) { maxChangesTracked = 50; }
            this.changeInfo = [];
            this.maxChangesTracked = Math.max(maxChangesTracked, 1);
        }
        ChangeTracker.prototype.addChangeItemsAdded = function (items) {
            this.addChange(ChangeTracker.createChangeInfoObjectFromArray(items, null, null));
        };
        ChangeTracker.prototype.addChangeItemsModified = function (items) {
            this.addChange(ChangeTracker.createChangeInfoObjectFromArray(null, items, null));
        };
        ChangeTracker.prototype.addChangeItemsRemoved = function (items) {
            this.addChange(ChangeTracker.createChangeInfoObjectFromArray(null, null, items));
        };
        // create a change that acts like a change tracker (i.e. add/modify/remove changes are added to the underlying change object)
        ChangeTracker.prototype.createCompoundChange = function () {
            var change = ChangeTracker.createChangeInfoObject(0, 0, 0);
            this.addChange(change);
            var compoundChange = new CompoundCollectionChange(change);
            return compoundChange;
        };
        ChangeTracker.prototype.addChange = function (change) {
            if (change == null) {
                return;
            }
            // optimization for single change tracker
            if (this.maxChangesTracked === 1) {
                this.changeInfo[0] = change;
            }
            else {
                this.changeInfo.push(change);
                // if the change history is full, remove some items
                if (this.changeInfo.length > this.maxChangesTracked) {
                    if (this.maxChangesTracked > 3) {
                        var deleteCount = (this.maxChangesTracked >> 2); // delete 1/4 of the change history at a time when the history array is full
                        this.changeInfo.splice(0, deleteCount);
                    }
                    else {
                        this.changeInfo.shift();
                    }
                }
            }
        };
        /** Create a change object with 'added', 'modified', and 'removed' counts equal to the input parameter(s)
         */
        ChangeTracker.createChangeInfoObjectFromArray = function (added, modified, removed) {
            return ChangeTracker.createChangeInfoObject((added ? added.length ? added.length : 1 : 0), (modified ? modified.length || 1 : 0), (removed ? removed.length || 1 : 0));
        };
        ChangeTracker.createChangeInfoObject = function (added, modified, removed) {
            return {
                added: added,
                modified: modified,
                removed: removed,
            };
        };
        return ChangeTracker;
    })();
    ChangeTrackersImpl.ChangeTracker = ChangeTracker;
})(ChangeTrackersImpl || (ChangeTrackersImpl = {}));
module.exports = ChangeTrackersImpl;
