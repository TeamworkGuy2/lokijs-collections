﻿import Objects = require("../../ts-mortar/utils/Objects");

/** Contains a set of model definitions.
 * Dto Models are designed around server-side object property names and values
 * being formatted differently than local model property names and values.
 * Each model contains a list of properties with meta-attributes defining data-type,
 * default value, and source code template expressions for converting properties to and from service objects.
 * @author TeamworkGuy2
 * @since 2015-12-16
 */
class ModelDefinitionsSet implements ModelDefinitions {
    private static EMPTY_ARRAY = Object.freeze([]);

    private cloneDeep: <T1>(obj: T1) => T1;
    public dataTypes: { [id: string]: ModelDefinitions.DataTypeDefault };
    public modelNames: string[];
    public models: { [id: string]: DtoModelNamed | DtoCollectionSvcModelNamed<any, any> };
    private modelDefs: { [id: string]: DataCollectionModel<any> };
    private modelsFuncs: { [id: string]: DataCollectionModelAllFuncs<any, any> };


    // generate model information the first time this JS module loads
    constructor(dataModels: { [id: string]: DtoModel | DtoCollectionSvcModel<any, any> },
            dataTypes: { [id: string]: ModelDefinitions.DataTypeDefault }, cloneDeep: <T1>(obj: T1) => T1 = Objects.cloneDeep) {
        this.cloneDeep = cloneDeep;
        this.dataTypes = dataTypes;
        this.models = Objects.map(dataModels, (k, v) => Objects.assign(cloneDeep(v), { name: k }));
        var { modelDefs, modelsFuncs } = ModelDefinitionsSet.modelDefsToCollectionModelDefs(dataModels);
        this.modelDefs = modelDefs;
        this.modelsFuncs = modelsFuncs;
        this.modelNames = Object.keys(dataModels);
    }


    /* planning to implement in future
    function checkModelName(modelName) {
        if(modelDefsByName[modelName] == null) {
            throw new Error("unknown model name: " + modelName);
        }
    }
    */


    public addModel<U, W>(modelName: string, model: DtoModel | DtoCollectionSvcModel<U, W>): { modelDef: DataCollectionModel<U>; modelFuncs: DataCollectionModelAllFuncs<U, W> } {
        if (this.modelDefs[modelName] != null) {
            throw new Error("model named '" + modelName + "' already exists, cannot add new model by that name");
        }
        // clone the model first, so we're not modifying it when we attach the name
        var modelCopy = Objects.assign(this.cloneDeep(model), { name: modelName });

        var collModel = ModelDefinitionsSet.modelDefToCollectionModelDef(modelName, modelCopy);
        this.modelNames.push(modelName);
        this.models[modelName] = modelCopy;
        this.modelDefs[modelName] = collModel.modelDef;
        this.modelsFuncs[modelName] = collModel.modelFuncs;
        return collModel;
    }


    /** Get names of primary key properties of a model
     * @param {string} modelName: the name of the model
     * @return {string[]} an array of primary key names in the specified model,
     * or an empty string if the {@code modelName} is not recognized
     */
    public getPrimaryKeyNames(modelName: string): string[] {
        var modelDef = this.modelDefs[modelName];
        return modelDef && modelDef.primaryKeys || ModelDefinitionsSet.EMPTY_ARRAY;
    }


    /** Get names of auto-generated properties of a model
     * @param {string} modelName: the name of the model
     * @return {string[]} an array of auto-generated property names in the
     * specified model, or an empty string if the {@code modelName} is not recognized
     */
    public getAutoGeneratedKeyNames(modelName: string): string[] {
        var modelDef = this.modelDefs[modelName];
        return modelDef && modelDef.autoGeneratedKeys || ModelDefinitionsSet.EMPTY_ARRAY;
    }


    public getFieldNames(modelName: string): string[] {
        var modelDef = this.modelDefs[modelName];
        return modelDef && modelDef.fieldNames || ModelDefinitionsSet.EMPTY_ARRAY;
    }


    public getCopyFunc(modelName: string): (obj: any) => any {
        var modelFuncs = this.modelsFuncs[modelName];
        return modelFuncs && modelFuncs.copyFunc || null;
    }


    public getDataModel(modelName: string): DataCollectionModel<any> {
        return this.modelDefs[modelName];
    }


    public getDataModelFuncs(modelName: string): DataCollectionModelAllFuncs<any, any> {
        return this.modelsFuncs[modelName];
    }


    public static fromCollectionModels(dataModels: { [id: string]: DtoModel | DtoCollectionSvcModel<any, any> },
            dataTypes: { [id: string]: ModelDefinitions.DataTypeDefault }, cloneDeep: <T1>(obj: T1) => T1 = Objects.cloneDeep): ModelDefinitionsSet {
        var inst = new ModelDefinitionsSet(dataModels, dataTypes, cloneDeep);
        return inst;
    }

}

module ModelDefinitionsSet {

    export function extendModelTemplate(parent: StringMap<DtoPropertyTemplate>, child: StringMap<DtoPropertyTemplate>, cloneDeep?: <T1>(obj: T1) => T1): StringMap<DtoPropertyTemplate> {
        var res = Objects.map(parent, null, (k, v) => cloneDtoPropertyTemplate(v));

        for (var childProp in child) {
            res[childProp] = cloneDtoPropertyTemplate(child[childProp], cloneDeep);
        }
        return res;
    }


    /** the last argument is the child class, each previous argument is the parent that the child will extend.
     * equivalent to {@code extendModelDef(inheritanceChain[0], extendModelDef(inheritanceChain[1], extendModelDef(...)))}
     * @return {StringMap<DtoPropertyTemplate>} the original child class (last argument) extended by all other arguments
     */
    export function multiExtendModelTemplate(...inheritanceChain: StringMap<DtoPropertyTemplate>[]): StringMap<DtoPropertyTemplate> {
        var childClass = inheritanceChain[inheritanceChain.length - 1];
        for (var i = inheritanceChain.length - 2; i > -1; i--) {
            childClass = extendModelTemplate(inheritanceChain[i], childClass);
        }
        return childClass;
    }


    // creates maps of model names to primary key property and auto-generate property names
    export function modelDefToCollectionModelDef<U, W>(collectionName: string, dataModel: DtoModel | DtoCollectionModel<U> | DtoCollectionSvcModel<U, W>): { modelDef: DataCollectionModel<U>; modelFuncs: DataCollectionModelAllFuncs<U, W> } {
        var dataModels: { [id: string]: DtoModel | DtoCollectionSvcModel<any, any> } = {};
        dataModels[collectionName] = dataModel;
        var res = modelDefsToCollectionModelDefs(dataModels, [collectionName]);
        return {
            modelDef: res.modelDefs[collectionName],
            modelFuncs: res.modelsFuncs[collectionName]
        };
    }


    // creates maps of model names to primary key property and auto-generate property names
    export function modelDefsToCollectionModelDefs<U, W>(dataModels: { [id: string]: DtoModel | DtoCollectionModel<U> | DtoCollectionSvcModel<U, W> },
            modelNames?: string[]): { modelDefs: { [name: string]: DataCollectionModel<U> }; modelsFuncs: { [name: string]: DataCollectionModelAllFuncs<U, W> } } {

        var modelDefs: { [id: string]: DataCollectionModel<any> } = {};
        var modelsFuncs: { [id: string]: DataCollectionModelAllFuncs<any, any> } = {};

        modelNames = modelNames || Object.keys(dataModels);
        for (var i = 0, size = modelNames.length; i < size; i++) {
            var modelName = modelNames[i];
            var table = dataModels[modelName];
            var tableProps = table.properties;

            // setup mapping of model names to collection names and vice versa
            var primaryKeys: string[] = [];
            var autoGeneratedKeys: string[] = [];

            var fieldNames = Object.keys(tableProps);
            for (var ii = 0, sizeI = fieldNames.length; ii < sizeI; ii++) {
                var propName = fieldNames[ii];
                var propVal = tableProps[propName];
                if (propVal.primaryKey === true) {
                    primaryKeys.push(propName);
                }
                if (propVal.autoGenerate === true) {
                    autoGeneratedKeys.push(propName);
                }
            }

            modelDefs[modelName] = {
                fieldNames,
                primaryKeys,
                autoGeneratedKeys
            };

            var tableFuncs = <DtoCollectionSvcModel<any, any>>table;

            modelsFuncs[modelName] = {
                copyFunc: tableFuncs.copyFunc,
                convertToLocalObjectFunc: tableFuncs.convertToLocalObjectFunc,
                convertToSvcObjectFunc: tableFuncs.convertToSvcObjectFunc
            };
        }

        return { modelDefs, modelsFuncs };
    }


    export function cloneDtoPropertyTemplate(prop: DtoPropertyTemplate & PropertyConversionTemplate, cloneDeep: <T1>(obj: T1) => T1 = Objects.cloneDeep): DtoPropertyTemplate & PropertyConversionTemplate {
        return {
            autoGenerate: prop.autoGenerate,
            defaultValue: prop.defaultValue != null ? cloneDeep(prop.defaultValue) : null,
            primaryKey: prop.primaryKey,
            readOnly: prop.readOnly,
            required: prop.required,
            server: prop.server == null ? null : {
                autoGenerate: prop.server.autoGenerate,
                defaultValue: prop.server.defaultValue != null ? cloneDeep(prop.server.defaultValue) : null,
                name: prop.server.name,
                primaryKey: prop.server.primaryKey,
                readOnly: prop.server.readOnly,
                required: prop.server.required,
                type: prop.server.type,
            },
            toLocal: prop.toLocal,
            toService: prop.toService,
            type: prop.type,
        };
    }

}

export = ModelDefinitionsSet;
