/*
 * Copyright 2015 The Chromium Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be
 * found in the LICENSE file.
 */
/**
 * @interface
 */
export class LayerView {
  /**
   * @param {?LayerViewer.LayerView.Selection} selection
   */
  hoverObject(selection) {
  }

  /**
   * @param {?LayerViewer.LayerView.Selection} selection
   */
  selectObject(selection) {
  }

  /**
   * @param {?SDK.LayerTreeBase} layerTree
   */
  setLayerTree(layerTree) {}
}

/**
 * @unrestricted
 */
export class Selection {
  /**
   * @param {!LayerViewer.LayerView.Selection.Type} type
   * @param {!SDK.Layer} layer
   */
  constructor(type, layer) {
    this._type = type;
    this._layer = layer;
  }

  /**
   * @param {?LayerViewer.LayerView.Selection} a
   * @param {?LayerViewer.LayerView.Selection} b
   * @return {boolean}
   */
  static isEqual(a, b) {
    return a && b ? a._isEqual(b) : a === b;
  }

  /**
   * @return {!LayerViewer.LayerView.Selection.Type}
   */
  type() {
    return this._type;
  }

  /**
   * @return {!SDK.Layer}
   */
  layer() {
    return this._layer;
  }

  /**
   * @param {!LayerViewer.LayerView.Selection} other
   * @return {boolean}
   */
  _isEqual(other) {
    return false;
  }
}

/**
 * @enum {symbol}
 */
export const Type = {
  Layer: Symbol('Layer'),
  ScrollRect: Symbol('ScrollRect'),
  Snapshot: Symbol('Snapshot')
};

/**
 * @unrestricted
 */
export class LayerSelection extends Selection {
  /**
   * @param {!SDK.Layer} layer
   */
  constructor(layer) {
    console.assert(layer, 'LayerSelection with empty layer');
    super(Type.Layer, layer);
  }

  /**
   * @override
   * @param {!LayerViewer.LayerView.Selection} other
   * @return {boolean}
   */
  _isEqual(other) {
    return other._type === Type.Layer && other.layer().id() === this.layer().id();
  }
}

/**
 * @unrestricted
 */
export class ScrollRectSelection extends Selection {
  /**
   * @param {!SDK.Layer} layer
   * @param {number} scrollRectIndex
   */
  constructor(layer, scrollRectIndex) {
    super(Type.ScrollRect, layer);
    this.scrollRectIndex = scrollRectIndex;
  }

  /**
   * @override
   * @param {!LayerViewer.LayerView.Selection} other
   * @return {boolean}
   */
  _isEqual(other) {
    return other._type === Type.ScrollRect && this.layer().id() === other.layer().id() &&
        this.scrollRectIndex === other.scrollRectIndex;
  }
}

/**
 * @unrestricted
 */
export class SnapshotSelection extends Selection {
  /**
   * @param {!SDK.Layer} layer
   * @param {!SDK.SnapshotWithRect} snapshot
   */
  constructor(layer, snapshot) {
    super(Type.Snapshot, layer);
    this._snapshot = snapshot;
  }

  /**
   * @override
   * @param {!LayerViewer.LayerView.Selection} other
   * @return {boolean}
   */
  _isEqual(other) {
    return other._type === Type.Snapshot && this.layer().id() === other.layer().id() &&
        this._snapshot === other._snapshot;
  }

  /**
   * @return {!SDK.SnapshotWithRect}
   */
  snapshot() {
    return this._snapshot;
  }
}

/**
 * @unrestricted
 */
export class LayerViewHost {
  constructor() {
    /** @type {!Array.<!LayerViewer.LayerView>} */
    this._views = [];
    this._selectedObject = null;
    this._hoveredObject = null;
    this._showInternalLayersSetting = Common.settings.createSetting('layersShowInternalLayers', false);
  }

  /**
   * @param {!LayerViewer.LayerView} layerView
   */
  registerView(layerView) {
    this._views.push(layerView);
  }

  /**
   * @param {!Map<!SDK.Layer, !LayerViewer.LayerView.SnapshotSelection>} snapshotLayers
   */
  setLayerSnapshotMap(snapshotLayers) {
    this._snapshotLayers = snapshotLayers;
  }

  /**
   * @return {!Map<!SDK.Layer, !LayerViewer.LayerView.SnapshotSelection>}
   */
  getLayerSnapshotMap() {
    return this._snapshotLayers;
  }

  /**
   * @param {?SDK.LayerTreeBase} layerTree
   */
  setLayerTree(layerTree) {
    this._target = layerTree.target();
    const selectedLayer = this._selectedObject && this._selectedObject.layer();
    if (selectedLayer && (!layerTree || !layerTree.layerById(selectedLayer.id()))) {
      this.selectObject(null);
    }
    const hoveredLayer = this._hoveredObject && this._hoveredObject.layer();
    if (hoveredLayer && (!layerTree || !layerTree.layerById(hoveredLayer.id()))) {
      this.hoverObject(null);
    }
    for (const view of this._views) {
      view.setLayerTree(layerTree);
    }
  }

  /**
   * @param {?LayerViewer.LayerView.Selection} selection
   */
  hoverObject(selection) {
    if (Selection.isEqual(this._hoveredObject, selection)) {
      return;
    }
    this._hoveredObject = selection;
    const layer = selection && selection.layer();
    this._toggleNodeHighlight(layer ? layer.nodeForSelfOrAncestor() : null);
    for (const view of this._views) {
      view.hoverObject(selection);
    }
  }

  /**
   * @param {?LayerViewer.LayerView.Selection} selection
   */
  selectObject(selection) {
    if (Selection.isEqual(this._selectedObject, selection)) {
      return;
    }
    this._selectedObject = selection;
    for (const view of this._views) {
      view.selectObject(selection);
    }
  }

  /**
   * @return {?LayerViewer.LayerView.Selection}
   */
  selection() {
    return this._selectedObject;
  }

  /**
   * @param {!UI.ContextMenu} contextMenu
   * @param {?LayerViewer.LayerView.Selection} selection
   */
  showContextMenu(contextMenu, selection) {
    contextMenu.defaultSection().appendCheckboxItem(
        Common.UIString('Show internal layers'), this._toggleShowInternalLayers.bind(this),
        this._showInternalLayersSetting.get());
    const node = selection && selection.layer() && selection.layer().nodeForSelfOrAncestor();
    if (node) {
      contextMenu.appendApplicableItems(node);
    }
    contextMenu.show();
  }

  /**
   * @return {!Common.Setting}
   */
  showInternalLayersSetting() {
    return this._showInternalLayersSetting;
  }

  _toggleShowInternalLayers() {
    this._showInternalLayersSetting.set(!this._showInternalLayersSetting.get());
  }

  /**
   * @param {?SDK.DOMNode} node
   */
  _toggleNodeHighlight(node) {
    if (node) {
      node.highlightForTwoSeconds();
      return;
    }
    SDK.OverlayModel.hideDOMNodeHighlight();
  }
}

/* Legacy exported object */
self.LayerViewer = self.LayerViewer || {};

/* Legacy exported object */
LayerViewer = LayerViewer || {};

/**
 * @interface
 */
LayerViewer.LayerView = LayerView;

/**
 * @constructor
 */
LayerViewer.LayerView.Selection = Selection;

/**
 * @enum {symbol}
 */
LayerViewer.LayerView.Selection.Type = Type;

/**
 * @constructor
 */
LayerViewer.LayerView.LayerSelection = LayerSelection;

/**
 * @constructor
 */
LayerViewer.LayerView.ScrollRectSelection = ScrollRectSelection;

/**
 * @constructor
 */
LayerViewer.LayerView.SnapshotSelection = SnapshotSelection;

/**
 * @constructor
 */
LayerViewer.LayerViewHost = LayerViewHost;
