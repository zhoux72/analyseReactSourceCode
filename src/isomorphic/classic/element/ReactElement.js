/**
 * Copyright 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactElement
 */

'use strict';

var ReactCurrentOwner = require('ReactCurrentOwner');

var warning = require('warning');
//检测环境是否支持Object.defineProperty方法
var canDefineProperty = require('canDefineProperty');

// The Symbol used to tag the ReactElement type. If there is no native Symbol
// nor polyfill, then a plain number is used for performance.
//由于ReactElement对象实例不是通过new的方式创建，无法通过instanceof方法检测其类型
//因此将Symbol用于ReactElement类型的对象的$$typeof属性，以便检测某个对象是否是ReactElement类型的
var REACT_ELEMENT_TYPE =
  (typeof Symbol === 'function' && Symbol.for && Symbol.for('react.element')) ||
  0xeac7;

//保留的props
var RESERVED_PROPS = {
  key: true,
  ref: true,
  __self: true,
  __source: true,
};

var specialPropKeyWarningShown, specialPropRefWarningShown;

/**
 * Factory method to create a new React element. This no longer adheres to
 * the class pattern, so do not use new to call it. Also, no instanceof check
 * will work. Instead test $$typeof field against Symbol.for('react.element') to check
 * if something is a React Element.
 *
 * @param {*} type
 * @param {*} key
 * @param {string|object} ref
 * @param {*} self A *temporary* helper to detect places where `this` is
 * different from the `owner` when React.createElement is called, so that we
 * can warn. We want to get rid of owner and replace string `ref`s with arrow
 * functions, and as long as `this` and owner are the same, there will be no
 * change in behavior.
 * @param {*} source An annotation object (added by a transpiler or otherwise)
 * indicating filename, line number, and/or other information.
 * @param {*} owner
 * @param {*} props
 * @internal
 */
var ReactElement = function(type, key, ref, self, source, owner, props) {
  var element = {
    // This tag allow us to uniquely identify this as a React Element
    $$typeof: REACT_ELEMENT_TYPE,

    // Built-in properties that belong on the element
    type: type,
    key: key,
    ref: ref,
    props: props,

    //暂时不清楚作用
    // Record the component responsible for creating this element.
    _owner: owner,
  };
  //__DEV__为在react-15.0.0\scripts\jest\environment.js中定义的全局变量
  if (__DEV__) {
    // The validation flag is currently mutative. We put it on
    // an external backing store so that we can freeze the whole object.
    // This can be replaced with a WeakMap once they are implemented in
    // commonly used development environments.
    element._store = {};

    // To make comparing ReactElements easier for testing purposes, we make
    // the validation flag non-enumerable (where possible, which should
    // include every environment we run tests in), so the test framework
    // ignores it.
    if (canDefineProperty) {
      Object.defineProperty(element._store, 'validated', {
        configurable: false,
        enumerable: false,
        writable: true,
        value: false,
      });
      // self and source are DEV only properties.
      Object.defineProperty(element, '_self', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: self,
      });
      // Two elements created in two different places should be considered
      // equal for testing purposes and therefore we hide it from enumeration.
      Object.defineProperty(element, '_source', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: source,
      });
    } else {
      element._store.validated = false;
      element._self = self;
      element._source = source;
    }
    if (Object.freeze) {
      Object.freeze(element.props);
      Object.freeze(element);
    }
  }

  return element;
};

//config中的4个保留props单独提取出来
//config中的其余非保留props复制到新建的空props对象中
//有多个children参数时，将其合并到一个数组中，并挂载到props对象的children属性上，只有一个children参数时，直接挂载
//将defaultProps中未在config中设置的prop添加到props对象中
//用上述参数和type参数调用ReactElement方法创建实例对象
ReactElement.createElement = function(type, config, children) {
  var propName;

  // Reserved names are extracted
  var props = {};

  var key = null;
  var ref = null;
  var self = null;
  var source = null;

  if (config != null) {
    if (__DEV__) {
      //为什么特别区分ref和key是否是访问器属性？
      //因为在开发模式下，config参数中没有key和ref属性时，会利用访问器属性在访问key和ref时打印警告信息
      ref = !config.hasOwnProperty('ref') ||
        Object.getOwnPropertyDescriptor(config, 'ref').get ? null : config.ref;
      key = !config.hasOwnProperty('key') ||
        Object.getOwnPropertyDescriptor(config, 'key').get ? null : '' + config.key;
    } else {
      ref = config.ref === undefined ? null : config.ref;
      key = config.key === undefined ? null : '' + config.key;
    }
    self = config.__self === undefined ? null : config.__self;
    source = config.__source === undefined ? null : config.__source;
    // Remaining properties are added to a new props object
    //复制config中的非保留props到新建的props空对象中
    for (propName in config) {
      if (config.hasOwnProperty(propName) &&
          !RESERVED_PROPS.hasOwnProperty(propName)) {
        props[propName] = config[propName];
      }
    }
  }

  // Children can be more than one argument, and those are transferred onto
  // the newly allocated props object.
  //可以有多个children参数，但会将多个children参数合并为一个数组参数，挂载到props对象上
  var childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    var childArray = Array(childrenLength);
    for (var i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  // Resolve default props
  //遍历defaultProps，如果没有在config中设置该项prop（前述步骤也就不会将其添加到props对象中），则将defaultProps中的该项prop添加到props对象中
  if (type && type.defaultProps) {
    var defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }
  if (__DEV__) {
    // Create dummy `key` and `ref` property to `props` to warn users
    // against its use
    if (typeof props.$$typeof === 'undefined' ||
        props.$$typeof !== REACT_ELEMENT_TYPE) {
      if (!props.hasOwnProperty('key')) {
        Object.defineProperty(props, 'key', {
          get: function() {
            if (!specialPropKeyWarningShown) {
              specialPropKeyWarningShown = true;
              warning(
                false,
                '%s: `key` is not a prop. Trying to access it will result ' +
                  'in `undefined` being returned. If you need to access the same ' +
                  'value within the child component, you should pass it as a different ' +
                  'prop. (https://fb.me/react-special-props)',
                typeof type === 'function' && 'displayName' in type ? type.displayName : 'Element'
              );
            }
            return undefined;
          },
          configurable: true,
        });
      }
      if (!props.hasOwnProperty('ref')) {
        Object.defineProperty(props, 'ref', {
          get: function() {
            if (!specialPropRefWarningShown) {
              specialPropRefWarningShown = true;
              warning(
                false,
                '%s: `ref` is not a prop. Trying to access it will result ' +
                  'in `undefined` being returned. If you need to access the same ' +
                  'value within the child component, you should pass it as a different ' +
                  'prop. (https://fb.me/react-special-props)',
                typeof type === 'function' && 'displayName' in type ? type.displayName : 'Element'
              );
            }
            return undefined;
          },
          configurable: true,
        });
      }
    }
  }
  return ReactElement(
    type,
    key,
    ref,
    self,
    source,
    ReactCurrentOwner.current,
    props
  );
};

ReactElement.createFactory = function(type) {
  var factory = ReactElement.createElement.bind(null, type);
  // Expose the type on the factory and the prototype so that it can be
  // easily accessed on elements. E.g. `<Foo />.type === Foo`.
  // This should not be named `constructor` since this may not be the function
  // that created the element, and it may not even be a constructor.
  // Legacy hook TODO: Warn if this is accessed
  factory.type = type;
  return factory;
};

ReactElement.cloneAndReplaceKey = function(oldElement, newKey) {
  var newElement = ReactElement(
    oldElement.type,
    newKey,
    oldElement.ref,
    oldElement._self,
    oldElement._source,
    oldElement._owner,
    oldElement.props
  );

  return newElement;
};

ReactElement.cloneElement = function(element, config, children) {
  var propName;

  // Original props are copied
  var props = Object.assign({}, element.props);

  // Reserved names are extracted
  var key = element.key;
  var ref = element.ref;
  // Self is preserved since the owner is preserved.
  var self = element._self;
  // Source is preserved since cloneElement is unlikely to be targeted by a
  // transpiler, and the original source is probably a better indicator of the
  // true owner.
  var source = element._source;

  // Owner will be preserved, unless ref is overridden
  var owner = element._owner;

  if (config != null) {
    if (config.ref !== undefined) {
      // Silently steal the ref from the parent.
      ref = config.ref;
      owner = ReactCurrentOwner.current;
    }
    if (config.key !== undefined) {
      key = '' + config.key;
    }
    // Remaining properties override existing props
    var defaultProps;
    if (element.type && element.type.defaultProps) {
      defaultProps = element.type.defaultProps;
    }
    for (propName in config) {
      if (config.hasOwnProperty(propName) &&
          !RESERVED_PROPS.hasOwnProperty(propName)) {
        if (config[propName] === undefined && defaultProps !== undefined) {
          // Resolve default props
          props[propName] = defaultProps[propName];
        } else {
          props[propName] = config[propName];
        }
      }
    }
  }

  // Children can be more than one argument, and those are transferred onto
  // the newly allocated props object.
  var childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    var childArray = Array(childrenLength);
    for (var i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  return ReactElement(
    element.type,
    key,
    ref,
    self,
    source,
    owner,
    props
  );
};

/**
 * @param {?object} object
 * @return {boolean} True if `object` is a valid component.
 * @final
 */
ReactElement.isValidElement = function(object) {
  return (
    //检测一个对象是否具有某个属性（或是否等于某个值）的安全检测方法
    typeof object === 'object' &&
    object !== null &&
    object.$$typeof === REACT_ELEMENT_TYPE
  );
};

module.exports = ReactElement;
