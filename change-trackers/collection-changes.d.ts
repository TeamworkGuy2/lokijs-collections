
/** Interfaces for collection changes (i.e. add, remove, update)
 * @author TeamworkGuy2
 */
declare module Changes {

    export interface CollectionChangeTracker {
        addChangeItemsAdded(items: any | any[]);
        addChangeItemsModified(items: any | any[]);
        addChangeItemsRemoved(items: any | any[]);
        addChange(change: CollectionChange);
    }


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
