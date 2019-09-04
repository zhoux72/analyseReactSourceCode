/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule instantiateReactComponent
 */

'use strict';

var ReactCompositeComponent = require('ReactCompositeComponent');
var ReactEmptyComponent = require('ReactEmptyComponent');
var ReactNativeComponent = require('ReactNativeComponent');

//invariant：A way to provide descriptive errors in development but generic errors in production.
//第一个参数为false时会在开发模式下提供第二个参数指定的报错信息
var invariant = require('invariant');
var warning = require('warning');

// To avoid a cyclic dependency, we create the final class in this module
var ReactCompositeComponentWrapper = function(element) {
  this.construct(element);
};
Object.assign(
  ReactCompositeComponentWrapper.prototype,
  ReactCompositeComponent.Mixin,
  {
    _instantiateReactComponent: instantiateReactComponent,
  }
);

function getDeclarationErrorAddendum(owner) {
  if (owner) {
    var name = owner.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

/**
 * Check if the type reference is a known internal type. I.e. not a user
 * provided composite type.
 *
 * @param {function} type
 * @return {boolean} Returns true if this is a valid internal type.
 */
 //检测所给类型是否是内部自定义组件
function isInternalComponentType(type) {
  return (
    typeof type === 'function' &&
    typeof type.prototype !== 'undefined' &&
    typeof type.prototype.mountComponent === 'function' &&
    typeof type.prototype.receiveComponent === 'function'
  );
}

/**
 * Given a ReactNode, create an instance that will actually be mounted.
 *
 * @param {ReactNode} node
 * @return {object} A new instance of the element's constructor.
 * @protected
 */
 //实例化React组件
function instantiateReactComponent(node) {
  var instance;

  if (node === null || node === false) {
    //node === null || node === false表示空组件
    //返回的instance实例_currentElement、_nativeNode、_nativeParent、_nativeContainerInfo、_domID均为null，
    //原型上包含了mountComponent、receiveComponent、getNativeNode、unmountComponent方法
    //instantiateReactComponent参数貌似并没有用到
    instance = ReactEmptyComponent.create(instantiateReactComponent);
  } else if (typeof node === 'object') {
    //typeof node === 'object'表示DOM标签组件或自定义组件
    var element = node;
    //element的type为string时表示DOM标签组件，为function时表示自定义组件
    //element的type为string和function以外的值时提示报错信息
    invariant(
      element && (typeof element.type === 'function' ||
                  typeof element.type === 'string'),
      'Element type is invalid: expected a string (for built-in components) ' +
      'or a class/function (for composite components) but got: %s.%s',
      element.type == null ? element.type : typeof element.type,
      getDeclarationErrorAddendum(element._owner)
    );

    // Special case string values
    if (typeof element.type === 'string') {
      //DOM标签组件
      //返回的instance实例tag属性为element.type的小写形式，_flags等于0
      //_currentElement、_tag、_namespaceURI、_renderedChildren、_rootNodeID、_domID等属性均为null
      //原型方法上挂载了mountComponent、receiveComponent、updateComponent、getNativeNode、unmountComponent、getPublicInstance方法
      instance = ReactNativeComponent.createInternalComponent(element);
    } else if (isInternalComponentType(element.type)) {
      //内部自定义组件
      //内部自定义组件已在原型上挂载好mountComponent、receiveComponent方法，直接实例化
      // This is temporarily available for custom components that are not string
      // representations. I.e. ART. Once those are updated to use the string
      // representation, we can drop this code path.
      instance = new element.type(element);
    } else {
      //非内部自定义组件
      //返回的instance实例_currentElement属性为element，_mountOrder等于0
      //_rootNodeID、_instance、_nativeParent、_pendingCallbacks等属性为null
      //_pendingReplaceState、_pendingForceUpdate为false
      //原型方法上挂载了mountComponent、performInitialMountWithErrorHandling、performInitialMount、getNativeNode、unmountComponent
      //receiveComponent、performUpdateIfNecessary、updateComponent、attachRef、detachRef、getName、getPublicInstance方法
      instance = new ReactCompositeComponentWrapper(element);
    }
  } else if (typeof node === 'string' || typeof node === 'number') {
    //typeof node === 'string' || typeof node === 'number'表示文本组件
    //返回的instance实例_currentElement为node、_stringText为node的字符串形式，_mountIndex为0
    //_nativeNode、_nativeParent、_domID、_closingComment、_commentNodes为null
    //原型方法上挂载了mountComponent、receiveComponent、getNativeNode、unmountComponent方法
    instance = ReactNativeComponent.createInstanceForText(node);
  } else {
    invariant(
      false,
      'Encountered invalid React node of type %s',
      typeof node
    );
  }

  if (__DEV__) {
    warning(
      typeof instance.mountComponent === 'function' &&
      typeof instance.receiveComponent === 'function' &&
      typeof instance.getNativeNode === 'function' &&
      typeof instance.unmountComponent === 'function',
      'Only React Components can be mounted.'
    );
  }

  // These two fields are used by the DOM and ART diffing algorithms
  // respectively. Instead of using expandos on components, we should be
  // storing the state needed by the diffing algorithms elsewhere.
  instance._mountIndex = 0;
  instance._mountImage = null;

  if (__DEV__) {
    instance._isOwnerNecessary = false;
    instance._warnedAboutRefsInRender = false;
  }

  // Internal instances should fully constructed at this point, so they should
  // not get any new fields added to them at this point.
  if (__DEV__) {
    if (Object.preventExtensions) {
      //阻止对象扩展，让一个对象变的不可扩展，也就是永远不能再添加新的属性
      Object.preventExtensions(instance);
    }
  }

  return instance;
}

module.exports = instantiateReactComponent;
