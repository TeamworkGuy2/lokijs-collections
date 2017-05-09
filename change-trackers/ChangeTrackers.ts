/// <reference path="./collection-changes.d.ts" />

/** Change tracking for data collections.  Currently the events being tracked are: added items, modified items, and removed items.
 * @author TeamworkGuy2
 */
module ChangeTrackers {

    /** A CollectionChangeInfo wrapper which simply adds to its existing 'added', 'modified', 'removed' values
     */
    export class CompoundCollectionChange implements Changes.CollectionChangeTracker, Changes.CollectionChange {
        private changeInfo: Changes.CollectionChange;


        constructor(changeInfo?: Changes.CollectionChange) {
            this.changeInfo = changeInfo || ChangeTracker.createChangeInfoObject(0, 0, 0);
        }


        public get added() { return this.changeInfo.added; }

        public get modified() { return this.changeInfo.modified; }

        public get removed() { return this.changeInfo.removed; }


        public addChangeItemsAdded(items: any | any[]) {
            this.changeInfo.added += (items ? items.length || 1 : 0);
        }


        public addChangeItemsModified(items: any | any[]) {
            this.changeInfo.modified += (items ? items.length || 1 : 0);
        }


        public addChangeItemsRemoved(items: any | any[]) {
            this.changeInfo.removed += (items ? items.length || 1 : 0);
        }


        public addChange(change: Changes.CollectionChange) {
            if (change == null) {
                return;
            }

            this.changeInfo.added += (!isNaN(change.added) ? change.added : 0);
            this.changeInfo.modified += (!isNaN(change.modified) ? change.modified : 0);
            this.changeInfo.removed += (!isNaN(change.removed) ? change.removed : 0);
        }

    }




    /** Default CollectionChangeInfo implementation using a change history buffer with a maximum size
     */
    export class ChangeTracker implements Changes.CollectionChangeTracker {
        private changeInfo: Changes.CollectionChange[] = [];
        private maxChangesTracked: number;


        constructor(maxChangesTracked: number = 50) {
            this.maxChangesTracked = Math.max(maxChangesTracked, 1);
        }


        public addChangeItemsAdded(items: any | any[]) {
            this.addChange(ChangeTracker.createChangeInfoObjectFromArray(items, null, null));
        }


        public addChangeItemsModified(items: any | any[]) {
            this.addChange(ChangeTracker.createChangeInfoObjectFromArray(null, items, null));
        }


        public addChangeItemsRemoved(items: any | any[]) {
            this.addChange(ChangeTracker.createChangeInfoObjectFromArray(null, null, items));
        }


        // create a change that acts like a change tracker (i.e. add/modify/remove changes are added to the underlying change object)
        public createCompoundChange(): Changes.CollectionChangeTracker {
            var change = ChangeTracker.createChangeInfoObject(0, 0, 0);
            this.addChange(change);
            var compoundChange = new CompoundCollectionChange(change);
            return compoundChange;
        }


        public addChange(change: Changes.CollectionChange) {
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
        }


        /** Create a change object with 'added', 'modified', and 'removed' counts equal to the input parameter(s)
         */
        private static createChangeInfoObjectFromArray(added: any | any[], modified: any | any[], removed: any | any[]) {
            return ChangeTracker.createChangeInfoObject((added ? added.length ? added.length : 1 : 0),
                (modified ? modified.length || 1 : 0),
                (removed ? removed.length || 1 : 0));
        }


        static createChangeInfoObject(added: number, modified: number, removed: number) {
            return {
                added: added,
                modified: modified,
                removed: removed,
            }
        }

    }

}

export = ChangeTrackers;
