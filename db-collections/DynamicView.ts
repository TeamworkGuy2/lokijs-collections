import Collection = require("./Collection");
import EventEmitter = require("./TsEventEmitter");
import Resultset = require("./Resultset");

/** DynamicView class is a versatile 'live' view class which can have filters and sorts applied.
 *   Collection.addDynamicView(name) instantiates this DynamicView object and notifies it
 *   whenever documents are add/updated/removed so it can remain up-to-date. (chainable)
 *
 *   Examples:
 *   var mydv = mycollection.addDynamicView('test');  // default is non-persistent
 *   mydv.applyWhere(function(obj) { return obj.name === 'Toyota'; });
 *   mydv.applyFind({ 'doors' : 4 });
 *   var results = mydv.data();
 */
class DynamicView<T> implements MemDbDynamicView<T> {
    cachedresultset: MemDbResultset<T> | null;
    collection: MemDbCollection<T>;
    events: TsEventEmitter<{
        'rebuild': any[];
    }>;
    filterPipeline: ({ type: "find"; val: MemDbQuery } | { type: "where"; val: (obj: T) => boolean })[];
    name: string;
    persistent: boolean;
    resultdata: T[];
    resultsdirty: boolean;
    resultset: MemDbResultset<T>;
    sortCriteria: [keyof T, boolean][] | null;
    sortDirty: boolean;
    sortFunction: ((a: any, b: any) => number) | null;


    /**
     * @param collection - A reference to the collection to work against
     * @param name - The name of this dynamic view
     * @param persistent - (Optional) If true, the results will be copied into an internal array for read efficiency or binding to.
     */
    constructor(collection: MemDbCollection<T>, name: string, persistent?: boolean) {
        this.collection = collection;
        this.name = name;

        this.persistent = (typeof persistent !== "undefined" ? persistent : false);

        this.resultset = Resultset.from(collection);
        this.resultdata = [];
        this.resultsdirty = false;

        this.cachedresultset = null;

        // keep ordered filter pipeline
        this.filterPipeline = [];

        // sorting member variables
        // we only support one active search, applied using applySort() or applySimpleSort()
        this.sortFunction = null;
        this.sortCriteria = null;
        this.sortDirty = false;

        // for now just have 1 event for when we finally rebuilt lazy view
        // once we refactor transactions, i will tie in certain transactional events
        this.events = new EventEmitter({
            "rebuild": []
        });
    }


    /** rematerialize() - intended for use immediately after deserialization (loading)
     *   This will clear out and reapply filterPipeline ops, recreating the view.
     *   Since where filters do not persist correctly, this method allows
     *   restoring the view to state where user can re-apply those where filters.
     *
     * @param options - (Optional) allows specification of 'removeWhereFilters' option
     * @returns This dynamic view for further chained ops.
     */
    public rematerialize(options?: { removeWhereFilters?: boolean; }) {
        var fpl: number,
            fpi: number;

        options = options || {};

        this.resultdata = [];
        this.resultsdirty = true;
        this.resultset = Resultset.from(this.collection);

        if (this.sortFunction || this.sortCriteria) {
            this.sortDirty = true;
        }

        if (!!options.removeWhereFilters) {
            // for each view see if it had any where filters applied... since they don't
            // serialize those functions lets remove those invalid filters
            fpl = this.filterPipeline.length;
            fpi = fpl;
            while (fpi--) {
                if (this.filterPipeline[fpi].type === "where") {
                    if (fpi !== this.filterPipeline.length - 1) {
                        this.filterPipeline[fpi] = this.filterPipeline[this.filterPipeline.length - 1];
                    }
                    this.filterPipeline.length--;
                }
            }
        }

        // back up old filter pipeline, clear filter pipeline, and reapply pipeline ops
        var ofp = this.filterPipeline;
        this.filterPipeline = [];

        // now re-apply 'find' filterPipeline ops
        fpl = ofp.length;
        for (var i = 0; i < fpl; i++) {
            this.applyFind(ofp[i].val);
        }

        // during creation of unit tests, i will remove this forced refresh and leave lazy
        this.data();

        // emit rebuild event in case user wants to be notified
        this.events.emit("rebuild", this);

        return this;
    }


    /** branchResultset() - Makes a copy of the internal resultset for branched queries.
     *   Unlike this dynamic view, the branched resultset will not be 'live' updated,
     *   so your branched query should be immediately resolved and not held for future evaluation.
     *
     * @returns A copy of the internal resultset for branched queries.
     */
    public branchResultset() {
        return this.resultset.copy();
    }


    /** toJSON() - Override of toJSON to avoid circular references
     */
    public toJSON() {
        var copy = new DynamicView(this.collection, this.name, this.persistent);
        copy.filterPipeline = this.filterPipeline;
        copy.resultdata = []; // let's not save data (copy) to minimize size
        copy.resultsdirty = true;
        copy.resultset = this.resultset;
        copy.sortCriteria = this.sortCriteria;
        copy.sortDirty = this.sortDirty;
        copy.sortFunction = this.sortFunction;
        // avoid circular reference, reapply in db.loadJSON()
        copy.collection = <never>null;

        return copy;
    }


    /** applySort() - Used to apply a sort to the dynamic view
     *
     * @param compareFunc - a javascript compare function used for sorting
     * @returns this DynamicView object, for further chain ops.
     */
    public applySort(compareFunc: ((a: any, b: any) => number) | null) {
        this.sortFunction = compareFunc;
        this.sortCriteria = null;

        this.queueSortPhase();

        return this;
    }


    /** applySimpleSort() - Used to specify a property used for view translation.
     *
     * @param propname - Name of property by which to sort.
     * @param isdesc - (Optional) If true, the sort will be in descending order.
     * @returns this DynamicView object, for further chain ops.
     */
    public applySimpleSort(propname: keyof T & string, isdesc?: boolean) {
        if (isdesc === undefined) {
            isdesc = false;
        }

        this.sortCriteria = [
            [propname, isdesc]
        ];
        this.sortFunction = null;

        this.queueSortPhase();

        return this;
    }


    /** applySortCriteria() - Allows sorting a resultset based on multiple columns.
     *    Example : dv.applySortCriteria(['age', 'name']); to sort by age and then name (both ascending)
     *    Example : dv.applySortCriteria(['age', ['name', true]); to sort by age (ascending) and then by name (descending)
     *    Example : dv.applySortCriteria(['age', true], ['name', true]); to sort by age (descending) and then by name (descending)
     *
     * @param properties - array of property names or subarray of [propertyname, isdesc] used evaluate sort order
     * @returns Reference to this DynamicView, sorted, for future chain operations.
     */
    public applySortCriteria(criteria: [keyof T, boolean][] | null) {
        this.sortCriteria = criteria;
        this.sortFunction = null;

        this.queueSortPhase();

        return this;
    }


    /** startTransaction() - marks the beginning of a transaction.
     *
     * @returns this DynamicView object, for further chain ops.
     */
    public startTransaction() {
        this.cachedresultset = this.resultset.copy();

        return this;
    }


    /** commit() - commits a transaction.
     *
     * @returns this DynamicView object, for further chain ops.
     */
    public commit() {
        this.cachedresultset = null;

        return this;
    }


    /** rollback() - rolls back a transaction.
     *
     * @returns this DynamicView object, for further chain ops.
     */
    public rollback() {
        if (this.cachedresultset == null) {
            throw new Error("cannot rollback() before startTransaction()")
        }

        this.resultset = this.cachedresultset;

        if (this.persistent) {
            // for now just rebuild the persistent dynamic view data in this worst case scenario
            // (a persistent view utilizing transactions which get rolled back), we already know the filter so not too bad.
            this.resultdata = this.resultset.data();

            this.events.emit("rebuild", this);
        }

        return this;
    }


    /** applyFind() - Adds a mongo-style query option to the DynamicView filter pipeline
     *
     * @param query - A mongo-style query object to apply to pipeline
     * @returns this DynamicView object, for further chain ops.
     */
    public applyFind(query: MemDbQuery) {
        this.filterPipeline.push({
            type: "find",
            val: query
        });

        // Apply immediately to Resultset; if persistent we will wait until later to build internal data
        this.resultset.find(query);

        if (this.sortFunction || this.sortCriteria) {
            this.sortDirty = true;
            this.queueSortPhase();
        }

        if (this.persistent) {
            this.resultsdirty = true;
            this.queueSortPhase();
        }

        return this;
    }


    /** applyWhere() - Adds a javascript filter function to the DynamicView filter pipeline
     *
     * @param fun - A javascript filter function to apply to pipeline
     * @returns this DynamicView object, for further chain ops.
     */
    public applyWhere(fun: (obj: T) => boolean) {
        this.filterPipeline.push({
            type: "where",
            val: fun
        });

        // Apply immediately to Resultset; if persistent we will wait until later to build internal data
        this.resultset.where(fun);

        if (this.sortFunction || this.sortCriteria) {
            this.sortDirty = true;
            this.queueSortPhase();
        }

        if (this.persistent) {
            this.resultsdirty = true;
            this.queueSortPhase();
        }

        return this;
    }


    /** data() - resolves and pending filtering and sorting, then returns document array as result.
     *
     * @returns An array of documents representing the current DynamicView contents.
     */
    public data() {
        // using final sort phase as 'catch all' for a few use cases which require full rebuild
        if (this.sortDirty || this.resultsdirty || !this.resultset.filterInitialized) {
            this.performSortPhase();
        }

        if (!this.persistent) {
            return this.resultset.data();
        }

        return this.resultdata;
    }


    /**
     */
    public queueSortPhase() {
        var self = this;

        // already queued? exit without queuing again
        if (this.sortDirty) {
            return;
        }

        this.sortDirty = true;

        // queue async call to performSortPhase()
        setTimeout(function () {
            self.performSortPhase();
        }, 1);
    }


    /** performSortPhase() - invoked synchronously or asynchronously to perform final sort phase (if needed)
     */
    public performSortPhase() {
        // async call to this may have been pre-empted by synchronous call to data before async could fire
        if (!this.sortDirty && !this.resultsdirty && this.resultset.filterInitialized) {
            return;
        }

        if (this.sortFunction != null) {
            this.resultset.sort(this.sortFunction);
        }

        if (this.sortCriteria != null) {
            this.resultset.compoundsort(this.sortCriteria);
        }

        if (!this.persistent) {
            this.sortDirty = false;
            return;
        }

        // persistent view, rebuild local resultdata array
        this.resultdata = this.resultset.data();
        this.resultsdirty = false;
        this.sortDirty = false;

        this.events.emit("rebuild", this);
    }


    /** evaluateDocument() - internal method for (re)evaluating document inclusion.
     *    Called by : collection.insert() and collection.update().
     *
     * @param objIndex - index of document to (re)run through filter pipeline.
     */
    public evaluateDocument(objIndex: number) {
        var ofr = this.resultset.filteredrows;
        var oldPos = ofr.indexOf(objIndex);
        var oldLen = ofr.length;

        // creating a 1-element resultset to run filter chain ops on to see if that doc passes filters;
        // mostly efficient algorithm, slight stack overhead price (this function is called on inserts and updates)
        var evalResultset = Resultset.from(this.collection);
        evalResultset.filteredrows = [objIndex];
        evalResultset.filterInitialized = true;
        var filters = this.filterPipeline;
        for (var idx = 0; idx < filters.length; idx++) {
            var filter = filters[idx];
            switch (filter.type) {
                case "find":
                    evalResultset.find(filter.val);
                    break;
                case "where":
                    evalResultset.where(filter.val);
                    break;
            }
        }

        // not a true position, but -1 if not pass our filter(s), 0 if passed filter(s)
        var newPos = (evalResultset.filteredrows.length === 0) ? -1 : 0;

        // wasn't in old, shouldn't be now... do nothing
        if (oldPos == -1 && newPos == -1) return;

        // wasn't in resultset, should be now... add
        if (oldPos === -1 && newPos !== -1) {
            ofr.push(objIndex);

            if (this.persistent) {
                this.resultdata.push(this.collection.data[objIndex]);
            }

            // need to re-sort to sort new document
            if (this.sortFunction || this.sortCriteria) {
                this.queueSortPhase();
            }
            return;
        }

        // was in resultset, shouldn't be now... delete
        if (oldPos !== -1 && newPos === -1) {
            if (oldPos < oldLen - 1) {
                // http://dvolvr.davidwaterston.com/2013/06/09/restating-the-obvious-the-fastest-way-to-truncate-an-array-in-javascript/comment-page-1/
                ofr[oldPos] = ofr[oldLen - 1];
                ofr.length = oldLen - 1;

                if (this.persistent) {
                    this.resultdata[oldPos] = this.resultdata[oldLen - 1];
                    this.resultdata.length = oldLen - 1;
                }
            }
            else {
                ofr.length = oldLen - 1;

                if (this.persistent) {
                    this.resultdata.length = oldLen - 1;
                }
            }

            // in case changes to data altered a sort column
            if (this.sortFunction || this.sortCriteria) {
                this.queueSortPhase();
            }
            return;
        }

        // was in resultset, should still be now... (update persistent only?)
        if (oldPos !== -1 && newPos !== -1) {
            if (this.persistent) {
                // in case document changed, replace persistent view data with the latest collection.data document
                this.resultdata[oldPos] = this.collection.data[objIndex];
            }

            // in case changes to data altered a sort column
            if (this.sortFunction || this.sortCriteria) {
                this.sortDirty = true;
            }
            return;
        }
    }


    /** removeDocument() - internal function called on collection.delete()
     */
    public removeDocument(objIndex: number) {
        var ofr = this.resultset.filteredrows;
        var oldPos = ofr.indexOf(objIndex);
        var oldlen = ofr.length;
        var idx;

        if (oldPos !== -1) {
            // if not last row in resultdata, swap last to hole and truncate last row
            if (oldPos < oldlen - 1) {
                ofr[oldPos] = ofr[oldlen - 1];
                ofr.length = oldlen - 1;

                if (this.persistent) {
                    this.resultdata[oldPos] = this.resultdata[oldlen - 1];
                    this.resultdata.length = oldlen - 1;
                }
            }
            // last row, so just truncate last row
            else {
                ofr.length = oldlen - 1;

                if (this.persistent) {
                    this.resultdata.length = oldlen - 1;
                }
            }

            // in case changes to data altered a sort column
            if (this.sortFunction || this.sortCriteria) {
                this.queueSortPhase();
            }
        }

        // since we are using filteredrows to store data array positions, if a document is
        // removed (whether in this view or not), adjust array positions -1 for all document array indices after that position
        oldlen = ofr.length;
        for (idx = 0; idx < oldlen; idx++) {
            if (ofr[idx] > objIndex) {
                ofr[idx]--;
            }
        }
    }

}

export = DynamicView;
