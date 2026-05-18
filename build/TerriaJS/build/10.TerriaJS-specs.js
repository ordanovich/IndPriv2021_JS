(window["webpackJsonp"] = window["webpackJsonp"] || []).push([[10],{

/***/ "../../node_modules/geotiff/dist-module/compression/deflate.js":
/*!***************************************************************************************************************!*\
  !*** /Users/lawrence.owen/code/terria/MAPS/terriaMap/node_modules/geotiff/dist-module/compression/deflate.js ***!
  \***************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"default\", function() { return DeflateDecoder; });\n/* harmony import */ var pako__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! pako */ \"../../node_modules/geotiff/node_modules/pako/dist/pako.esm.mjs\");\n/* harmony import */ var _basedecoder_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./basedecoder.js */ \"../../node_modules/geotiff/dist-module/compression/basedecoder.js\");\n\n\n\nclass DeflateDecoder extends _basedecoder_js__WEBPACK_IMPORTED_MODULE_1__[\"default\"] {\n  decodeBlock(buffer) {\n    return Object(pako__WEBPACK_IMPORTED_MODULE_0__[\"inflate\"])(new Uint8Array(buffer)).buffer;\n  }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi4vLi4vbm9kZV9tb2R1bGVzL2dlb3RpZmYvZGlzdC1tb2R1bGUvY29tcHJlc3Npb24vZGVmbGF0ZS5qcy5qcyIsInNvdXJjZXMiOlsid2VicGFjazovLy8vVXNlcnMvbGF3cmVuY2Uub3dlbi9jb2RlL3RlcnJpYS9NQVBTL3RlcnJpYU1hcC9ub2RlX21vZHVsZXMvZ2VvdGlmZi9kaXN0LW1vZHVsZS9jb21wcmVzc2lvbi9kZWZsYXRlLmpzPzA2MjkiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaW5mbGF0ZSB9IGZyb20gJ3Bha28nO1xuaW1wb3J0IEJhc2VEZWNvZGVyIGZyb20gJy4vYmFzZWRlY29kZXIuanMnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBEZWZsYXRlRGVjb2RlciBleHRlbmRzIEJhc2VEZWNvZGVyIHtcbiAgZGVjb2RlQmxvY2soYnVmZmVyKSB7XG4gICAgcmV0dXJuIGluZmxhdGUobmV3IFVpbnQ4QXJyYXkoYnVmZmVyKSkuYnVmZmVyO1xuICB9XG59XG4iXSwibWFwcGluZ3MiOiJBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTsiLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///../../node_modules/geotiff/dist-module/compression/deflate.js\n");

/***/ })

}]);