class Directive {
    constructor(el, me, attr, elementValue) {
        this.el = el;
        this.me = me;
        this.attr = attr;
        // this.el[this.attr] = this.elementValue = elementValue
    }
}

function set(target, key, value, receiver) {
    const result = Reflect.set(target, key, value, receiver);
    var dataSet = receiver || target;
    dataSet._bindings[key].forEach(function (item) {
        item.el[item.attr] = value;
    });
    return result;
}

class Me {
    constructor({
        el,
        data,
        methods
    }) {
        this.root = document.querySelector(el);
        this._data = data;
        this._data._bindings = {};
        this.data = new Proxy(this._data, {
            set
        });
        this.methods = methods;
        this._compile(this.root);
    }
    _compile(root) {
        let _this = this
        // 提取 {{ ?? }} 中的数据
        let bindDataTester = new RegExp("{{(.*?)}}", "ig");
        if (!root.hasChildNodes()) {
            return
        }
        for (let node of root.childNodes) {
            this._compile(node)
            // 当节点为Text时
            if (node.nodeType == 3) {
                if (bindDataTester.test(node.nodeValue)) {
                    let nodeList = node.nodeValue.split(/({{(.*?)}})/)
                    // node.nodeValue = "{{ note }} -> message:   name:{{name}} age:{{age}}"
                    //  nodeList =   ["", "{{ note }}", " note ", " -> message:   name:", "{{name}}", "name", " age:", "{{age}}", "age", ""]
                    let parentNode = node.parentNode
                    // parentNode = <div>{{ note }} -> message:   name:{{name}} age:{{age}}</div>
                    parentNode.innerHTML = ''
                    nodeList.map((item, index, arr) => {
                        if (bindDataTester.test(item)) {
                            let prop = item.replace(/{{(.*?)}}/, "$1").trim()
                            Reflect.deleteProperty(arr, index + 1)
                            // prop = "note"
                            if (prop) {
                                if (Reflect.has(this._data, prop)) {
                                    let propTextNode = document.createTextNode(this._data[prop])
                                    parentNode.append(propTextNode)
                                    if (Reflect.has(this._data._bindings, prop)) {
                                        this._data._bindings[prop].push(new Directive(propTextNode, this, "nodeValue", this.data[prop]))
                                    } else {
                                        this._data._bindings[prop] = [new Directive(propTextNode, this, "nodeValue", this.data[prop])]
                                    }
                                } else {
                                    console.error(`can not found ${prop} in data`)
                                }
                            } else {
                                console.error(node)
                                throw (`TMPL ERROR in ${root} component`)
                            }
                        } else if (item) {
                            let propTextNode = document.createTextNode(item)
                            parentNode.append(propTextNode)
                        }
                    })
                }
            }
            if (node.nodeType == 1) {
                if (node.hasAttribute('m-model')) {
                    node.addEventListener("input", (function () {

                        var attributeValue = node.getAttribute("m-model");
                        node.value = _this.data[attributeValue]
                        if (Reflect.has(_this._data._bindings, attributeValue)) _this._data._bindings[attributeValue].push(new Directive(node, _this, "value", _this.data[attributeValue]));
                        else _this._data._bindings[attributeValue] = [new Directive(node, _this, "value", _this.data[attributeValue])];

                        return function (event) {
                            _this.data[attributeValue] = event.target.value
                        }
                    })());
                }
                if (node.hasAttribute('m-click')) {
                    node.addEventListener('click', function () {
                        let attrValue = node.getAttribute('m-click');
                        let args = /\(.*\)/.exec(attrValue)
                        if (args) {
                            args = args[0];
                            attrValue = attrValue.replace(args, "");
                            args = args.replace(/[\(\)\'\"]/g, '').split(",");
                        } else args = [];
                        return function (event) {
                            _this.methods[attrValue].apply(_this, [event, ...args]);
                        }
                    }())
                }
            }
        }
    }
}