/**
 * Copyright 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DOMLazyTree
 */

'use strict';

var createMicrosoftUnsafeLocalFunction = require('createMicrosoftUnsafeLocalFunction');
var setTextContent = require('setTextContent');

/**
 * In IE (8-11) and Edge, appending nodes with no children is dramatically
 * faster than appending a full subtree, so we essentially queue up the
 * .appendChild calls here and apply them so each node is added to its parent
 * before any children are added.
 *
 * In other browsers, doing so is slower or neutral compared to the other order
 * (in Firefox, twice as slow) so we only do this inversion in IE.
 *
 * See https://github.com/spicyj/innerhtml-vs-createelement-vs-clonenode.
 */
 //在IE (8-11)和Edge浏览器中为true，其余浏览器为false
var enableLazy = (
  typeof document !== 'undefined' &&
  typeof document.documentMode === 'number'
  ||
  typeof navigator !== 'undefined' &&
  typeof navigator.userAgent === 'string' &&
  /\bEdge\/\d/.test(navigator.userAgent)
);

function insertTreeChildren(tree) {
  if (!enableLazy) {
    return;
  }
  var node = tree.node;
  var children = tree.children;
  if (children.length) {
    for (var i = 0; i < children.length; i++) {
      insertTreeBefore(node, children[i], null);
    }
  } else if (tree.html != null) {
    node.innerHTML = tree.html;
  } else if (tree.text != null) {
    setTextContent(node, tree.text);
  }
}

var insertTreeBefore = createMicrosoftUnsafeLocalFunction(
  function(parentNode, tree, referenceNode) {
    // DocumentFragments aren't actually part of the DOM after insertion so
    // appending children won't update the DOM. We need to ensure the fragment
    // is properly populated first, breaking out of our lazy approach for just
    // this level.
    if (tree.node.nodeType === 11) {
      insertTreeChildren(tree);
      parentNode.insertBefore(tree.node, referenceNode);
    } else {
      parentNode.insertBefore(tree.node, referenceNode);
      insertTreeChildren(tree);
    }
  }
);

function replaceChildWithTree(oldNode, newTree) {
  oldNode.parentNode.replaceChild(newTree.node, oldNode);
  insertTreeChildren(newTree);
}

function queueChild(parentTree, childTree) {
  if (enableLazy) {
    parentTree.children.push(childTree);
  } else {
    parentTree.node.appendChild(childTree.node);
  }
}

function queueHTML(tree, html) {
  if (enableLazy) {
    tree.html = html;
  } else {
    tree.node.innerHTML = html;
  }
}

function queueText(tree, text) {
  if (enableLazy) {
    tree.text = text;
  } else {
    setTextContent(tree.node, text);
  }
}

function DOMLazyTree(node) {
  return {
    //node用于保存当前的完整的节点，node为HTML原生的Node类型
    node: node,
    //IE浏览器下一次性将所有子节点都挂载到父级节点性能更好，将这种挂载方式定义为懒挂载
    //其余浏览器下每个节点都单独appendChild反而性能更好，定义这种运行环境为不支持懒挂载（自己命名的，便于理解）
    //children用于保存赖挂载的节点，如果运行环境支持懒挂载，则不会在挂载每个节点时都执行parentTree.node.appendChild(childTree.node)
    //会先执行parentTree.children.push(childTree)，将其保存到children中，所有节点添加完毕，再一次插入，性能更好
    //如果运行环境不支持懒挂载的话，会在挂载每个节点时都执行appendChild
    children: [],
    html: null,
    text: null,
  };
}

DOMLazyTree.insertTreeBefore = insertTreeBefore;
DOMLazyTree.replaceChildWithTree = replaceChildWithTree;
DOMLazyTree.queueChild = queueChild;
DOMLazyTree.queueHTML = queueHTML;
DOMLazyTree.queueText = queueText;

module.exports = DOMLazyTree;
