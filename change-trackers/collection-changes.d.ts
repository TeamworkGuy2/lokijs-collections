
/** Interfaces for collection changes (i.e. add, remove, update)
 * @author TeamworkGuy2
 */
declare module Changes {

    /** The API for a collection change tracker */
    export interface CollectionChangeTracker {

        /** Inform this change tracker that the following items have been added */
        addChangeItemsAdded(items: any | any[]);

        /** Inform this change tracker that the following items have been modified */
        addChangeItemsModified(items: any | any[]);

        /** Inform this change tracker that the following items have been removed */
        addChangeItemsRemoved(items: any | any[]);

        /** Inform this change tracker that the following change event has occured */
        addChange(change: CollectionChange);
    }


    /** A collection change event */
    export interface CollectionChange {
        originalCount?: number;
        added: number;
        modified: number;
        removed: number;
    }


    export interface ChangeListener {
        (change: CollectionChange): void;
    }

}
