import DtoPropertyConverter = require("@twg2/ts-twg-ast-codegen/code-types/DtoPropertyConverter");
import TypeConverter = require("@twg2/ts-twg-ast-codegen/code-types/TypeConverter");

module TestModels {

    export interface MdA {
        id: number;
        name: string;
        styles: string[];
    }

    export interface PkA {
        id: number;
    }

    export interface MdB {
        userId: string;
        token: string;
        note: string;
        lastModified: string;
        timestamp: Date;
    }

    export interface PkB {
        userId: string;
    }


    export var dataModels = {
        "coll_a": <DtoModel & DtoFuncs<any>>{
            properties: DtoPropertyConverter.parseAndConvertTemplateMap({
                "id": { primaryKey: true, autoGenerate: true, type: "number", server: { type: "long" } },
                "name": { type: "string", server: { type: "string" } },
                "styles": { type: "string[]", server: { type: "IList<String>" } },
            }, function typeConverter(t) { return TypeConverter.TypeScript.parseTypeTemplate(t, true); },
                function serverTypeConverter(t) { return (typeof t === "string" ? TypeConverter.parseTypeTemplate(t) : t); }),
            copyFunc: (a) => ({ id: a.id, name: a.name, styles: Array.prototype.slice.call(a.style || []) }),
        },
        "coll_b": <DtoModel & DtoFuncs<any>>{
            properties: DtoPropertyConverter.parseAndConvertTemplateMap({
                "userId": { type: "string", primaryKey: true },
                "token": { type: "string" },
                "note": { type: "string" },
                "lastModified": { type: "string" },
                "timestamp": { autoGenerate: true, type: "Date", server: { type: "DateTime" } },
            }, function typeConverter(t) { return TypeConverter.TypeScript.parseTypeTemplate(t, true); },
                function serverTypeConverter(t) { return (typeof t === "string" ? TypeConverter.parseTypeTemplate(t) : t); }),
            copyFunc: (a) => ({ userId: a.userId, token: a.token, note: a.note, timestamp: a.timestamp }),
        }
    };

    export var dataModelsMap = <StringMap<DtoModel & DtoFuncs<any>>><any>dataModels;


    export var itemA1: MdA;

    export var itemA2: MdA;

    export var itemA3: MdA;

    export var itemB1: MdB;

    export var itemB2: MdB;

    export var itemB3: MdB;


    export function rebuildItems() {
        var now = new Date();

        itemA1 = {
            id: <number><any>null,
            name: "Alfred",
            styles: ["color: #F0F0F0", "font-size: 12px"]
        };

        itemA2 = {
            id: <number><any>null,
            name: "Billy",
            styles: ["color: #33AACC", "font-size: 10px"]
        };

        itemA3 = {
            id: <number><any>null,
            name: "Charlie",
            styles: ["color: #CCBBAA", "font-size: 8px"]
        };

        itemB1 = {
            userId: "A0281",
            note: "the fabled warrior",
            token: "C8A33B1-3B8EA7D7F89",
            lastModified: now.toISOString(),
            timestamp: <Date><any>null,
        };

        itemB2 = {
            userId: "B0751",
            note: "the quiet monk",
            token: "89A324D-3B883283C22",
            lastModified: now.toISOString(),
            timestamp: <Date><any>null,
        };

        var yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);

        itemB3 = {
            userId: "C2204",
            note: "the quiet monk",
            token: "LL28VMN-28A946T3B28",
            lastModified: yesterday.toISOString(),
            timestamp: <Date><any>null,
        };

    }

}

export = TestModels;