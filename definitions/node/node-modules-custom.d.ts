/// <reference path="./node.d.ts" />

declare module 'gulp' {
    export function src(...args: any[]): any;
    export function dest(...args: any[]): any;
    export function task(...args: any[]): any;
}

declare module 'gulp-util' {
    export var env: {};
    export function log(...args: any[]): any;
}

declare module 'gulp-concat' {
    function gulpConcat(...args: any[]): any;
    export = gulpConcat;
}

declare module 'gulp-sass' { }

declare module 'gulp-minify-css' { }

declare module 'gulp-rename' {
    function gulpRename(...args: any[]): any;
    export = gulpRename;
}

declare module 'gulp-uglify' {
    function gulpUglify(...args: any[]): any;
    export = gulpUglify;
}

declare module 'browserify' { }

declare module 'watchify' {
    function watchify(...args: any[]): any;
    export = watchify;
}

declare module 'es6ify' {
    export function configure(...args: any[]): any;
    export var traceurOverrides: any;
}

declare module 'reactify' { }

declare module 'vinyl-source-stream' {
    function vinylSourceStream(...args: any[]): any;
    export = vinylSourceStream;
}

declare module 'gulp-6to5' { }

declare module 'q' { }

declare module 'exorcist' {
    function exorcist(...args: any[]): any;
    export = exorcist;
}
