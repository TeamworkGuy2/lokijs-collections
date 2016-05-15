"use strict";
var Objects = require("../../ts-mortar/utils/Objects");
/** Contains a set of model definitions.
 * Dto Models are designed around server-side object property names and values
 * being formatted differently than local model property names and values.
 * Each model contains a list of properties with meta-attributes defining data-type,
 * default value, and source code template expressions for converting properties to and from service objects.
 * @author TeamworkGuy2
 * @since 2015-12-16
 */
var ModelDefinitionsSet = (function () {
    // generate model information the first time this JS module loads
    function ModelDefinitionsSet(dataModels, dataTypes, cloneDeep) {
        if (cloneDeep === void 0) { cloneDeep = Objects.cloneDeep; }
        this.cloneDeep = cloneDeep;
        this.dataTypes = dataTypes;
        this.models = Objects.map(dataModels, function (k, v) { return Objects.assign(cloneDeep(v), { name: k }); });
        var _a = ModelDefinitionsSet.modelDefsToCollectionModelDefs(dataModels), modelDefs = _a.modelDefs, modelsFuncs = _a.modelsFuncs;
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
    ModelDefinitionsSet.prototype.addModel = function (modelName, model) {
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
    };
    /** Get names of primary key properties of a model
     * @param {string} modelName: the name of the model
     * @return {string[]} an array of primary key names in the specified model,
     * or an empty string if the {@code modelName} is not recognized
     */
    ModelDefinitionsSet.prototype.getPrimaryKeyNames = function (modelName) {
        var modelDef = this.modelDefs[modelName];
        return modelDef && modelDef.primaryKeys || ModelDefinitionsSet.EMPTY_ARRAY;
    };
    /** Get names of auto-generated properties of a model
     * @param {string} modelName: the name of the model
     * @return {string[]} an array of auto-generated property names in the
     * specified model, or an empty string if the {@code modelName} is not recognized
     */
    ModelDefinitionsSet.prototype.getAutoGeneratedKeyNames = function (modelName) {
        var modelDef = this.modelDefs[modelName];
        return modelDef && modelDef.autoGeneratedKeys || ModelDefinitionsSet.EMPTY_ARRAY;
    };
    ModelDefinitionsSet.prototype.getFieldNames = function (modelName) {
        var modelDef = this.modelDefs[modelName];
        return modelDef && modelDef.fieldNames || ModelDefinitionsSet.EMPTY_ARRAY;
    };
    ModelDefinitionsSet.prototype.getCopyFunc = function (modelName) {
        var modelFuncs = this.modelsFuncs[modelName];
        return modelFuncs && modelFuncs.copyFunc || null;
    };
    ModelDefinitionsSet.prototype.getDataModel = function (modelName) {
        return this.modelDefs[modelName];
    };
    ModelDefinitionsSet.prototype.getDataModelFuncs = function (modelName) {
        return this.modelsFuncs[modelName];
    };
    ModelDefinitionsSet.fromCollectionModels = function (dataModels, dataTypes, cloneDeep) {
        if (cloneDeep === void 0) { cloneDeep = Objects.cloneDeep; }
        var inst = new ModelDefinitionsSet(dataModels, dataTypes, cloneDeep);
        return inst;
    };
    ModelDefinitionsSet.EMPTY_ARRAY = Object.freeze([]);
    return ModelDefinitionsSet;
}());
var ModelDefinitionsSet;
(function (ModelDefinitionsSet) {
    function extendModelTemplate(parent, child, cloneDeep) {
        var res = Objects.map(parent, null, function (k, v) { return cloneDtoPropertyTemplate(v); });
        for (var childProp in child) {
            res[childProp] = cloneDtoPropertyTemplate(child[childProp], cloneDeep);
        }
        return res;
    }
    ModelDefinitionsSet.extendModelTemplate = extendModelTemplate;
    /** the last argument is the child class, each previous argument is the parent that the child will extend.
     * equivalent to {@code extendModelDef(inheritanceChain[0], extendModelDef(inheritanceChain[1], extendModelDef(...)))}
     * @return {StringMap<DtoPropertyTemplate>} the original child class (last argument) extended by all other arguments
     */
    function multiExtendModelTemplate() {
        var inheritanceChain = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            inheritanceChain[_i - 0] = arguments[_i];
        }
        var childClass = inheritanceChain[inheritanceChain.length - 1];
        for (var i = inheritanceChain.length - 2; i > -1; i--) {
            childClass = extendModelTemplate(inheritanceChain[i], childClass);
        }
        return childClass;
    }
    ModelDefinitionsSet.multiExtendModelTemplate = multiExtendModelTemplate;
    // creates maps of model names to primary key property and auto-generate property names
    function modelDefToCollectionModelDef(collectionName, dataModel) {
        var dataModels = {};
        dataModels[collectionName] = dataModel;
        var res = modelDefsToCollectionModelDefs(dataModels, [collectionName]);
        return {
            modelDef: res.modelDefs[collectionName],
            modelFuncs: res.modelsFuncs[collectionName]
        };
    }
    ModelDefinitionsSet.modelDefToCollectionModelDef = modelDefToCollectionModelDef;
    // creates maps of model names to primary key property and auto-generate property names
    function modelDefsToCollectionModelDefs(dataModels, modelNames) {
        var modelDefs = {};
        var modelsFuncs = {};
        modelNames = modelNames || Object.keys(dataModels);
        for (var i = 0, size = modelNames.length; i < size; i++) {
            var modelName = modelNames[i];
            var table = dataModels[modelName];
            var tableProps = table.properties;
            // setup mapping of model names to collection names and vice versa
            var primaryKeys = [];
            var autoGeneratedKeys = [];
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
                fieldNames: fieldNames,
                primaryKeys: primaryKeys,
                autoGeneratedKeys: autoGeneratedKeys
            };
            var tableFuncs = table;
            modelsFuncs[modelName] = {
                copyFunc: tableFuncs.copyFunc,
                convertToLocalObjectFunc: tableFuncs.convertToLocalObjectFunc,
                convertToSvcObjectFunc: tableFuncs.convertToSvcObjectFunc
            };
        }
        return { modelDefs: modelDefs, modelsFuncs: modelsFuncs };
    }
    ModelDefinitionsSet.modelDefsToCollectionModelDefs = modelDefsToCollectionModelDefs;
    function cloneDtoPropertyTemplate(prop, cloneDeep) {
        if (cloneDeep === void 0) { cloneDeep = Objects.cloneDeep; }
        return {
            autoGenerate: prop.autoGenerate,
            defaultValue: prop.defaultValue != null ? cloneDeep(prop.defaultValue) : prop.defaultValue,
            primaryKey: prop.primaryKey,
            readOnly: prop.readOnly,
            required: prop.required,
            server: prop.server == null ? null : {
                autoGenerate: prop.server.autoGenerate,
                defaultValue: prop.server.defaultValue != null ? cloneDeep(prop.server.defaultValue) : prop.server.defaultValue,
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
    ModelDefinitionsSet.cloneDtoPropertyTemplate = cloneDtoPropertyTemplate;
})(ModelDefinitionsSet || (ModelDefinitionsSet = {}));
module.exports = ModelDefinitionsSet;
