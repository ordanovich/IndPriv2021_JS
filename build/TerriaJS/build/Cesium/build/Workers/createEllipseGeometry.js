/**
 * @license
 * Cesium - https://github.com/CesiumGS/cesium
 * Version 1.134.0
 *
 * Copyright 2011-2022 Cesium Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Columbus View (Pat. Pend.)
 *
 * Portions licensed separately.
 * See https://github.com/CesiumGS/cesium/blob/main/LICENSE.md for full licensing details.
 */

import {
  EllipseGeometry_default
} from "./chunk-4GVTYTDA.js";
import "./chunk-HGRUZ75N.js";
import "./chunk-NZEFFI3J.js";
import "./chunk-OJVXRXEB.js";
import "./chunk-ZBQ5K54D.js";
import "./chunk-HJ7IZBEI.js";
import "./chunk-AR2FUSG6.js";
import "./chunk-64WSG7AT.js";
import "./chunk-BSEOOIWS.js";
import "./chunk-3D2JAUGB.js";
import "./chunk-7PLX65MV.js";
import "./chunk-S4NZVXU6.js";
import "./chunk-SGACO2KX.js";
import "./chunk-4LKEBUN5.js";
import "./chunk-HTN3YUM4.js";
import "./chunk-EHFMZFVC.js";
import {
  Cartesian3_default,
  Ellipsoid_default
} from "./chunk-CF72FAKC.js";
import "./chunk-NP46ZIBY.js";
import "./chunk-3G5XEUPY.js";
import "./chunk-PXDMWXO5.js";
import "./chunk-JJZWDROM.js";
import {
  defined_default
} from "./chunk-5GHCWGC4.js";

// packages/engine/Source/Workers/createEllipseGeometry.js
function createEllipseGeometry(ellipseGeometry, offset) {
  if (defined_default(offset)) {
    ellipseGeometry = EllipseGeometry_default.unpack(ellipseGeometry, offset);
  }
  ellipseGeometry._center = Cartesian3_default.clone(ellipseGeometry._center);
  ellipseGeometry._ellipsoid = Ellipsoid_default.clone(ellipseGeometry._ellipsoid);
  return EllipseGeometry_default.createGeometry(ellipseGeometry);
}
var createEllipseGeometry_default = createEllipseGeometry;
export {
  createEllipseGeometry_default as default
};
