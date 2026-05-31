/* Copyright 2014 Keith Amidon
   Copyright 2014 Peter Amidon
   Copyright 2018 John Kristian
   Copyright 2025 Steve Roth

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License. */

var required_groups = []
var the_form

var standardAttributes = {
  "cardinal-number": { pattern: "[0-9]*" },
  date: {
    pattern:
      "(0[1-9]|1[012])/(0[1-9]|1[0-9]|2[0-9]|3[01])/[1-2][0-9][0-9][0-9]",
    placeholder: "mm/dd/yyyy",
    cleanupHandler: evt => {
      let value = evt.target.value
      // M/D/YY:
      value = value.replace(/^([1-9])[-./]([1-9])[-./](\d\d)$/, '0$1/0$2/20$3')
      // MM/D/YY:
      value = value.replace(/^(0[1-9]|1[012])[-./]([1-9])[-./](\d\d)$/, '$1/0$2/20$3')
      // M/DD/YY:
      value = value.replace(/^([1-9])[-./](0[1-9]|[12]\d|3[01])[-./](\d\d)$/, '0$1/$2/20$3')
      // MDDYY:
      value = value.replace(/^(1)(0[1-9]|[123]0|31)(\d\d)$/, '0$1/$2/20$3')
      value = value.replace(/^([2-9])(0[1-9]|[12]\d|3[01])(\d\d)$/, '0$1/$2/20$3')
      // MMDDYY, MMDDYYYY:
      value = value.replace(/^(0[1-9]|1[012])(0[1-9]|[12]\d|3[01])(?:20)?(\d\d)$/, '$1/$2/20$3')
      // MM/DD/YY:
      value = value.replace(/^(0[1-9]|1[012])[-./](0[1-9]|[12]\d|3[01])[-./](\d\d)$/, '$1/$2/20$3')
      // M/D/YYYY:
      value = value.replace(/^([1-9])[-./]([1-9])[-./]20(\d\d)$/, '0$1/0$2/20$3')
      // MM/D/YYYY:
      value = value.replace(/^(0[1-9]|1[012])[-./]([1-9])[-./]?20(\d\d)$/, '$1/0$2/20$3')
      // M/DD/YYYY:
      value = value.replace(/^([1-9])[-./](0[1-9]|[12]\d|3[01])[-./]20(\d\d)$/, '0$1/$2/20$3')
      // MDDYYYY:
      value = value.replace(/^(1)(0[1-9]|[123]0|31)20(\d\d)$/, '0$1/$2/20$3')
      value = value.replace(/^([2-9])(0[1-9]|[12]\d|3[01])[-./]?20(\d\d)$/, '0$1/$2/20$3')
      evt.target.value = value
    },
  },
  frequency: { pattern: "[0-9]+(\.[0-9]+)?" },
  "frequency-offset": {
    pattern: "[\\-+]?[0-9]*\\.[0-9]+|[\\-+]?[0-9]+|[\\-+]",
  },
  "nonzero-cardinal-number": { pattern: "[1-9][0-9]*" },
  "phone-number": {
    pattern: "[a-zA-Z ]*([+][0-9]+ )?[0-9][0-9 \\-]*([xX][0-9]+)?",
    placeholder: "000-000-0000 x00",
    cleanupHandler: evt => {
      let value = evt.target.value
      const ext = /[xX][0-9]+$/.exec(value)
      if (ext) value = value.substring(0, ext.index)
      const digits = value.replaceAll(/[^0-9]/g, '')
      if (digits.length === 10) value = digits.substring(0, 3) + '-' + digits.substring(3, 6) + '-' + digits.substring(6)
      if (ext) value += ' ' + ext[0]
      evt.target.value = value
    },
  },
  "real-number": { pattern: "[\\-+]?[0-9]*\\.[0-9]+|[\\-+]?[0-9]+" },
  time: {
    pattern: "([01][0-9]|2[0-3]):?[0-5][0-9]|2400|24:00",
    placeholder: "hh:mm",
    cleanupHandler: evt => {
      let value = evt.target.value
      if (/^\d:?\d\d$/.test(value)) value = '0' + value
      if (/^\d\d\d\d/.test(value)) value = value.substring(0, 2) + ':' + value.substring(2)
      evt.target.value = value
    }
  },
  "zip-code": { pattern: "\\d{5}(?:-\\d{4})?" },
}

// UTILITY FUNCTIONS

function array_for_each(array, func) {
  return Array.prototype.forEach.call(array, func)
}

function setControlValue(control, value) {
  if (control.type === "checkbox" || control.type === "radio")
    control.checked = !!value
  else control.value = value
}

function controlValue(control) {
  if (control.type === "checkbox" || control.type === "radio")
    return control.checked ? "checked" : ""
  else return control.value
}

function anyChildHasValue(elm) {
  let found = false
  elm
    .querySelectorAll(
      "input[type=checkbox],input[type=radio],input[type=text],input:not([type]),select,textarea",
    )
    .forEach((control) => {
      if (controlValue(control)) found = true
    })
  return found
}

class ComboboxAutocomplete {
  /*
   *   This content is licensed according to the W3C Software License at
   *   https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   */
  constructor(comboboxNode, buttonNode, listboxNode) {
    this.comboboxNode = comboboxNode
    this.buttonNode = buttonNode
    this.listboxNode = listboxNode
    this.comboboxHasVisualFocus = false
    this.listboxHasVisualFocus = false
    this.hasHover = false
    this.allOptions = []
    this.option = null
    this.firstOption = null
    this.lastOption = null
    this.filteredOptions = []
    this.filter = ''
    this.comboboxNode.addEventListener('keydown', this.onComboboxKeyDown.bind(this))
    this.comboboxNode.addEventListener('keyup', this.onComboboxKeyUp.bind(this))
    this.comboboxNode.addEventListener('click', this.onComboboxClick.bind(this))
    this.comboboxNode.addEventListener('focus', this.onComboboxFocus.bind(this))
    this.comboboxNode.addEventListener('blur', this.onComboboxBlur.bind(this))
    document.body.addEventListener('pointerup', this.onBackgroundPointerUp.bind(this), true)
    this.listboxNode.addEventListener('pointerover', this.onListboxPointerover.bind(this))
    this.listboxNode.addEventListener('pointerout', this.onListboxPointerout.bind(this))
    var nodes = this.listboxNode.getElementsByTagName('LI')
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i]
      this.allOptions.push(node)
      node.addEventListener('click', this.onOptionClick.bind(this))
      node.addEventListener('pointerover', this.onOptionPointerover.bind(this))
      node.addEventListener('pointerout', this.onOptionPointerout.bind(this))
    }
    this.filterOptions()
    var button = this.comboboxNode.nextElementSibling
    if (button && button.tagName === 'BUTTON')
      button.addEventListener('click', this.onButtonClick.bind(this))
  }
  getLowercaseContent(node) { return node.textContent.toLowerCase() }
  isOptionInView(option) {
    var bounding = option.getBoundingClientRect()
    return (
      bounding.top >= 0 &&
      bounding.left >= 0 &&
      bounding.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) &&
      bounding.right <=
      (window.innerWidth || document.documentElement.clientWidth)
    )
  }
  setActiveDescendant(option) {
    if (option && this.listboxHasVisualFocus) {
      this.comboboxNode.setAttribute('aria-activedescendant', option.id)
      if (!this.isOptionInView(option))
        option.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else {
      this.comboboxNode.setAttribute('aria-activedescendant', '')
    }
  }
  setValue(value) {
    this.filter = value
    this.comboboxNode.value = this.filter
    this.comboboxNode.setSelectionRange(this.filter.length, this.filter.length)
    this.comboboxNode.dispatchEvent(new InputEvent('input', { bubbles: true }))
    this.filterOptions()
  }
  setOption(option, flag) {
    if (typeof flag !== 'boolean') flag = false
    if (option) {
      this.option = option
      this.setCurrentOptionStyle(this.option)
      this.setActiveDescendant(this.option)
      this.comboboxNode.value = this.option.textContent
      if (flag) {
        this.comboboxNode.setSelectionRange(this.option.textContent.length, this.option.textContent.length)
      } else {
        this.comboboxNode.setSelectionRange(this.filter.length, this.option.textContent.length)
      }
      this.comboboxNode.dispatchEvent(new InputEvent('input', { bubbles: true }))
    }
  }
  setVisualFocusCombobox() {
    this.listboxNode.classList.remove('focus')
    this.comboboxNode.parentNode.classList.add('focus')
    this.comboboxHasVisualFocus = true
    this.listboxHasVisualFocus = false
    this.setActiveDescendant(false)
  }
  setVisualFocusListbox() {
    this.comboboxNode.parentNode.classList.remove('focus')
    this.comboboxHasVisualFocus = false
    this.listboxHasVisualFocus = true
    this.listboxNode.classList.add('focus')
    this.setActiveDescendant(this.option)
  }
  removeVisualFocusAll() {
    this.comboboxNode.parentNode.classList.remove('focus')
    this.comboboxHasVisualFocus = false
    this.listboxHasVisualFocus = false
    this.listboxNode.classList.remove('focus')
    this.option = null
    this.setActiveDescendant(false)
  }
  filterOptions() {
    var option = null
    var currentOption = this.option
    var filter = this.filter.toLowerCase()
    this.filteredOptions = []
    this.listboxNode.innerHTML = ''
    for (var i = 0; i < this.allOptions.length; i++) {
      option = this.allOptions[i]
      if (filter.length === 0 || this.getLowercaseContent(option).indexOf(filter) === 0) {
        this.filteredOptions.push(option)
        this.listboxNode.appendChild(option)
      }
    }
    if (this.filteredOptions.length < 2) {
      this.filteredOptions = []
      this.listboxNode.innerHTML = ''
      for (var i = 0; i < this.allOptions.length; i++) {
        this.filteredOptions.push(this.allOptions[i])
        this.listboxNode.appendChild(this.allOptions[i])
      }
    }
    var numItems = this.filteredOptions.length
    if (numItems > 0) {
      this.firstOption = this.filteredOptions[0]
      this.lastOption = this.filteredOptions[numItems - 1]
      if (currentOption && this.filteredOptions.indexOf(currentOption) >= 0) {
        option = currentOption
      } else {
        option = this.firstOption
      }
    } else {
      this.firstOption = null
      option = null
      this.lastOption = null
    }
    return option
  }
  setCurrentOptionStyle(option) {
    for (var i = 0; i < this.filteredOptions.length; i++) {
      var opt = this.filteredOptions[i]
      if (opt === option) {
        opt.setAttribute('aria-selected', 'true')
        if (this.listboxNode.scrollTop + this.listboxNode.offsetHeight < opt.offsetTop + opt.offsetHeight) {
          this.listboxNode.scrollTop = opt.offsetTop + opt.offsetHeight - this.listboxNode.offsetHeight
        } else if (this.listboxNode.scrollTop > opt.offsetTop + 2) {
          this.listboxNode.scrollTop = opt.offsetTop
        }
      } else {
        opt.removeAttribute('aria-selected')
      }
    }
  }
  getPreviousOption(currentOption) {
    if (currentOption !== this.firstOption) {
      var index = this.filteredOptions.indexOf(currentOption)
      return this.filteredOptions[index - 1]
    }
    return this.lastOption
  }
  getNextOption(currentOption) {
    if (currentOption !== this.lastOption) {
      var index = this.filteredOptions.indexOf(currentOption)
      return this.filteredOptions[index + 1]
    }
    return this.firstOption
  }
  doesOptionHaveFocus() { return this.comboboxNode.getAttribute('aria-activedescendant') !== '' }
  isOpen() { return this.listboxNode.style.display === 'block' }
  isClosed() { return this.listboxNode.style.display !== 'block' }
  hasOptions() { return this.filteredOptions.length }
  open() {
    this.listboxNode.style.display = 'block'
    this.comboboxNode.setAttribute('aria-expanded', 'true')
    this.buttonNode.setAttribute('aria-expanded', 'true')
  }
  close(force) {
    if (typeof force !== 'boolean') force = false
    const lbfocus = this.listboxHasVisualFocus
    if (force || (!this.comboboxHasVisualFocus && !this.listboxHasVisualFocus && !this.hasHover)) {
      this.setCurrentOptionStyle(false)
      this.listboxNode.style.display = 'none'
      this.comboboxNode.setAttribute('aria-expanded', 'false')
      this.buttonNode.setAttribute('aria-expanded', 'false')
      this.setActiveDescendant(false)
      if (lbfocus) this.comboboxNode.parentNode.classList.add('focus')
    }
  }
  onComboboxKeyDown(event) {
    var flag = false,
      altKey = event.altKey
    if (event.ctrlKey || event.shiftKey) {
      return
    }
    switch (event.key) {
      case 'Enter':
        if (this.listboxHasVisualFocus)
          this.setValue(this.option.textContent)
        this.close(true)
        this.setVisualFocusCombobox()
        flag = true
        break
      case 'Down':
      case 'ArrowDown':
        if (this.filteredOptions.length > 0) {
          if (altKey) {
            this.open()
          } else {
            this.open()
            if (this.listboxHasVisualFocus || this.filteredOptions.length > 1) {
              this.setOption(this.getNextOption(this.option), true)
              this.setVisualFocusListbox()
            } else {
              this.setOption(this.firstOption, true)
              this.setVisualFocusListbox()
            }
          }
        }
        flag = true
        break
      case 'Up':
      case 'ArrowUp':
        if (this.hasOptions()) {
          if (this.listboxHasVisualFocus) {
            this.setOption(this.getPreviousOption(this.option), true)
          } else {
            this.open()
            if (!altKey) {
              this.setOption(this.lastOption, true)
              this.setVisualFocusListbox()
            }
          }
        }
        flag = true
        break
      case 'Esc':
      case 'Escape':
        if (this.isOpen()) {
          this.close(true)
          this.filter = this.comboboxNode.value
          this.filterOptions()
          this.setVisualFocusCombobox()
        } else {
          this.setValue('')
          this.comboboxNode.value = ''
          this.comboboxNode.dispatchEvent(new InputEvent('input', { bubbles: true }))
        }
        this.option = null
        flag = true
        break
      case 'Tab':
        this.close(true)
        if (this.listboxHasVisualFocus) {
          if (this.option) this.setValue(this.option.textContent)
        }
        break
      case 'Home':
        this.comboboxNode.setSelectionRange(0, 0)
        flag = true
        break
      case 'End':
        var length = this.comboboxNode.value.length
        this.comboboxNode.setSelectionRange(length, length)
        flag = true
        break
      default:
        break
    }
    if (flag) {
      event.stopPropagation()
      event.preventDefault()
    }
  }
  isPrintableCharacter(str) {
    return str.length === 1 && str.match(/\S| /)
  }
  onComboboxKeyUp(event) {
    var flag = false,
      option = null,
      char = event.key
    if (this.isPrintableCharacter(char))
      this.filter += char
    if (this.comboboxNode.value.length < this.filter.length) {
      this.filter = this.comboboxNode.value
      this.option = null
      this.filterOptions()
    }
    if (event.key === 'Escape' || event.key === 'Esc') return
    switch (event.key) {
      case 'Backspace':
        this.setVisualFocusCombobox()
        this.setCurrentOptionStyle(false)
        this.filter = this.comboboxNode.value
        this.option = null
        this.filterOptions()
        flag = true
        break
      case 'Left':
      case 'ArrowLeft':
      case 'Right':
      case 'ArrowRight':
      case 'Home':
      case 'End':
        this.filter = this.comboboxNode.value
        this.setVisualFocusCombobox()
        flag = true
        break
      default:
        if (this.isPrintableCharacter(char)) {
          this.setVisualFocusCombobox()
          this.setCurrentOptionStyle(false)
          flag = true
          option = this.filterOptions()
          if (option) {
            if (this.isClosed() && this.comboboxNode.value.length)
              this.open()
            if (this.getLowercaseContent(option).indexOf(this.comboboxNode.value.toLowerCase()) === 0) {
              this.option = option
              this.setCurrentOptionStyle(option)
              this.setOption(option)
            } else {
              this.option = null
              this.setCurrentOptionStyle(false)
            }
          } else {
            this.close()
            this.option = null
            this.setActiveDescendant(false)
          }
        }
        break
    }
    if (flag) {
      event.stopPropagation()
      event.preventDefault()
    }
  }
  onComboboxClick() {
    if (this.isOpen()) {
      this.close(true)
    } else {
      this.open()
    }
  }
  onComboboxFocus() {
    this.filter = this.comboboxNode.value
    this.filterOptions()
    this.setVisualFocusCombobox()
    this.option = null
    this.setCurrentOptionStyle(null)
  }
  onComboboxBlur() {
    this.removeVisualFocusAll()
  }
  onBackgroundPointerUp(event) {
    if (
      !this.comboboxNode.contains(event.target) &&
      !this.listboxNode.contains(event.target) &&
      !this.buttonNode.contains(event.target)
    ) {
      this.comboboxHasVisualFocus = false
      this.setCurrentOptionStyle(null)
      this.removeVisualFocusAll()
      setTimeout(this.close.bind(this, true), 300)
    }
  }
  onButtonClick() {
    if (this.isOpen()) {
      this.close(true)
    } else {
      this.open()
    }
    this.comboboxNode.focus()
    this.setVisualFocusCombobox()
  }
  onListboxPointerover() {
    this.hasHover = true
  }
  onListboxPointerout() {
    this.hasHover = false
    setTimeout(this.close.bind(this, false), 300)
  }
  onOptionClick(event) {
    this.comboboxNode.value = event.target.textContent
    this.comboboxNode.dispatchEvent(new InputEvent('input', { bubbles: true }))
    this.close(true)
  }
  onOptionPointerover() {
    this.hasHover = true
    this.open()
  }
  onOptionPointerout() {
    this.hasHover = false
    setTimeout(this.close.bind(this, false), 300)
  }
}

// A Conditional interprets the conditional in an element attribute
// (hidden-until, required-if, allowed-if) and dispatches 'change' events when
// the state of the conditional changes.
class Conditional extends EventTarget {
  static conditionals = {};
  static getOrMake(elm, attr) {
    const cstr = elm.getAttribute(attr)
    if (!cstr) return null
    return this.conditionals[cstr] || new Conditional(elm, attr)
  }
  constructor(elm, attr) {
    super()
    const form = elm.closest("form")
    if (!form) throw `${attr} outside of a form`
    const cstr = elm.getAttribute(attr)
    if (!cstr) return null
    const parts = cstr.split("=", 2)
    this.field = form[parts[0]]
    if (!this.field)
      throw `${attr}="${cstr}": no such form element "${parts[0]}"`
    if (this.field.type === "checkbox") this.test = () => this.field.checked
    else if (parts.length > 1) this.test = () => this.field.value == parts[1]
    else this.test = () => !!this.field.value
    this.was = this.test()
    if (this.field instanceof RadioNodeList)
      this.field.forEach((b) => {
        b.addEventListener("change", this.onChange.bind(this))
      })
    else if (this.field.type === "checkbox" || this.field.type === "radio")
      this.field.addEventListener("change", this.onChange.bind(this))
    else this.field.addEventListener("input", this.onChange.bind(this))
    this.constructor.conditionals[cstr] = this
  }
  onChange() {
    const is = this.test()
    if (is != this.was) {
      this.was = is
      this.dispatchEvent(new CustomEvent("change", { detail: is }))
    }
  }
  reset() {
    this.was = this.test()
  }
}

// SHARED FUNCTIONS (idempotent, called in startup and event handlers)

// Enables or disables the submit buttons based on form validity.
function adjust_submit() {
  var valid = the_form.checkValidity()
  document.querySelector("#button-header").classList.toggle("valid", valid)
  document.querySelector("#submit").disabled = !valid
  var invalid_example = document.querySelector("#invalid-example")
  invalid_example.hidden = valid
  invalid_example.classList.toggle("hidden", valid)
  return valid
}

// Adjusts the pattern of a text field based on its type and required state.
// For a textarea, it adjusts the invalid class.
function adjust_pattern(input) {
  var pattern = input.pattern
  for (var s in standardAttributes) {
    if (input.classList.contains(s)) {
      var standard = standardAttributes[s]
      if (standard) pattern = standard.pattern
    }
  }
  if (input.type == "textarea") {
    input.classList.toggle(
      "invalid",
      input.required && (!input.value || !input.value.trim()),
    )
  } else if (input.type == "text") {
    if (pattern == "\\s*\\S.*") pattern = ""
    if (input.required) {
      if (!pattern) {
        pattern = "\\s*\\S.*" // not all white space
      }
    } else if (pattern) {
      pattern += "|\\s*" // all white space
    }
  }
  if (pattern) {
    if (input.classList.contains("clearable")) {
      pattern += "|\\{CLEAR\\}"
    }
    if (input.pattern != pattern) {
      input.pattern = pattern
    }
  } else if (input.pattern) {
    input.removeAttribute("pattern")
  }
}

// Adjusts the required flags on all controls in a required group.
function adjust_required_group(group) {
  if (group.querySelector(":checked") || group.closest("[hidden]") || !group.classList.contains('required-group')) {
    group.querySelectorAll("input[type=checkbox]:required").forEach((r) => {
      r.required = false
    })
    group.classList.remove("invalid")
  } else {
    let haveRequired = false,
      seenRFC = false
    group
      .querySelectorAll('input[type="checkbox"],input[type="radio"]')
      .forEach((r) => {
        if (r.disabled) return
        r.required = true
        haveRequired = true
      })
    group.classList.toggle("invalid", haveRequired)
  }
}

// Adjusts the required flags on all controls in required groups.
function adjust_required_groups() {
  required_groups.forEach(adjust_required_group)
  adjust_submit()
}

// Adjusts the required and disabled flags of controls based on required-if,
// allowed-if, and else-disallowed attributes.
function adjust_required_disabled() {
  document
    .querySelectorAll(
      "input[type=checkbox],input[type=radio],input[type=text],input:not([type]),select,textarea",
    )
    .forEach((elm) => {
      if (elm.closest("[hidden]")) return
      let state
      if (elm.hasAttribute("required-if")) {
        if (elm.hasAttribute("allowed-if"))
          throw "control cannot have both required-if and allowed-if attributes"
        const cond = Conditional.getOrMake(elm, "required-if")
        if (cond.test()) state = "required"
        else if (elm.hasAttribute("else-disallowed")) state = "disallowed"
        else state = "optional"
      } else if (elm.hasAttribute("allowed-if")) {
        const cond = Conditional.getOrMake(elm, "allowed-if")
        state = cond.test() ? "optional" : "disallowed"
      }
      switch (state) {
        case "required":
          elm.required = true
          elm.disabled = false
          if (elm.hasAttribute("disallowed-value")) {
            setControlValue(elm, elm.getAttribute("disallowed-value"))
            elm.removeAttribute("disallowed-value")
          }
          break
        case "optional":
          elm.required = false
          elm.disabled = false
          if (elm.hasAttribute("disallowed-value")) {
            setControlValue(elm, elm.getAttribute("disallowed-value"))
            elm.removeAttribute("disallowed-value")
          }
          break
        case "disallowed":
          elm.required = false
          if (elm.type === "checkbox" || elm.type === "radio") {
            if (elm.checked) elm.setAttribute("disallowed-value", "checked")
            elm.checked = false
          } else if (elm.value) {
            elm.setAttribute("disallowed-value", elm.value)
            elm.value = ""
          }
          elm.disabled = true
          break
      }
      adjust_pattern(elm)
    })
  document
    .querySelectorAll(".required-group,.was-required-group")
    .forEach((elm) => {
      if (elm.closest("[hidden]")) return
      if (!elm.hasAttribute("required-if")) return
      const cond = Conditional.getOrMake(elm, "required-if")
      if (cond.test()) {
        elm.classList.remove('was-required-group')
        elm.classList.add('required-group')
      } else {
        elm.classList.remove('required-group')
        elm.classList.add('was-required-group')
      }
    })
  adjust_required_groups()
}

// EVENT HANDLERS

// Triggered on any form input.
function on_form_input() {
  adjust_submit()
}

// Triggered when a hidden-until element's condition becomes true.
function on_hidden_until(evt, elm) {
  if (!evt.target.test()) return
  elm.removeAttribute("hidden")
  elm.querySelectorAll("[hidden-save-required]").forEach((control) => {
    control.setAttribute(
      "required",
      control.getAttribute("hidden-save-required"),
    )
    control.removeAttribute("hidden-save-required")
  })
  adjust_required_disabled()
}

// Triggered when a control in a required-group changes.
function on_required_group_change(evt) {
  adjust_required_group(evt.target.closest(".required-group"))
  adjust_submit()
}

// Triggered by Reset Form button.
function on_reset() {
  the_form.reset()
  reset_form()
}

// Triggered by Submit or Save button.
async function on_submit(evt) {
  const submit = evt.target.id == "submit"
  if (submit && !adjust_submit()) return
  const fd = new FormData(the_form)
  if (submit) fd.set("readyToSend", "true")
  const resp = await fetch(the_form.action, {
    method: "POST",
    body: fd,
    redirect: "manual",
  })
  if (resp.status == 204) {
    const action = resp.headers.get("X-Packet-Action")
    if (action.startsWith("redirect:")) location.href = action.substring(9)
    else if (window.opener) {
      window.opener.childAction(resp.headers.get("X-Packet-Action"))
      window.close()
    }
  } else document.getElementById("error").textContent = await resp.text()
}

// Triggered by Show PDF button.
function on_show_pdf() {
  window.open(the_form.dataset.pdfUrl, "_blank")
}

// RESET FUNCTIONS (run at startup and whenever the form is reset)

// Re-hides elements with hidden-until attributes that are not satisfied.
function reset_hidden_until() {
  document.querySelectorAll("[hidden-until]").forEach((elm) => {
    const cond = Conditional.getOrMake(elm, "hidden-until")
    if (cond.test() || anyChildHasValue(elm)) return
    cond.reset()
    elm.setAttribute("hidden", "")
    elm.querySelectorAll("[required]").forEach((control) => {
      control.setAttribute(
        "hidden-save-required",
        control.getAttribute("required"),
      )
      control.removeAttribute("required")
    })
  })
}

function reset_form() {
  reset_hidden_until()
  adjust_required_disabled()
}

// SETUP FUNCTIONS (run only once)

// Set up the combo boxes, if any.
function setup_comboboxes() {
  var comboboxes = document.querySelectorAll('.combobox-list')
  for (var i = 0; i < comboboxes.length; i++) {
    var combobox = comboboxes[i]
    var comboboxNode = combobox.querySelector('input')
    var buttonNode = combobox.querySelector('button')
    var listboxNode = combobox.querySelector('[role="listbox"]')
    new ComboboxAutocomplete(comboboxNode, buttonNode, listboxNode)
  }
}

// Sets up listeners on elements with unsatisfied hidden-until attributes.
function setup_hidden_until() {
  document.querySelectorAll("[hidden-until]").forEach((elm) => {
    const cond = Conditional.getOrMake(elm, "hidden-until")
    if (cond.test() || anyChildHasValue(elm)) return
    cond.addEventListener("change", (evt) => {
      on_hidden_until(evt, elm)
    })
  })
}

// Returns whether an element has required-if or allowed-if (or, implicitly,
// else-disallowed) attributes.
function has_conditionals(elm) {
  return elm.hasAttribute("required-if") || elm.hasAttribute("allowed-if")
}

// Copies the required-if, allowed-if, and/or else-disallowed attributes from
// the nearest ancestor that has them, if any.
function inherit_conditionals(elm) {
  if (has_conditionals(elm)) return
  for (let p = elm.parentElement; p; p = p.parentElement) {
    if (has_conditionals(p)) {
      if (p.hasAttribute("required-if"))
        elm.setAttribute("required-if", p.getAttribute("required-if"))
      if (p.hasAttribute("allowed-if"))
        elm.setAttribute("allowed-if", p.getAttribute("allowed-if"))
      if (p.hasAttribute("else-disallowed"))
        elm.setAttribute("else-disallowed", p.getAttribute("else-disallowed"))
      return
    }
  }
}

// Sets up conditional presence requirements based on the required-if,
// allowed-if, and else-disallowed attributes.
function setup_required_if() {
  document
    .querySelectorAll("input[type=checkbox],input[type=radio]")
    .forEach((elm) => {
      inherit_conditionals(elm)
      elm.addEventListener("change", adjust_required_disabled)
    })
  document
    .querySelectorAll("input[type=text],input:not([type]),select,textarea")
    .forEach((elm) => {
      inherit_conditionals(elm)
      elm.addEventListener("input", adjust_required_disabled)
    })
  document.querySelectorAll('.required-group').forEach(elm => {
    inherit_conditionals(elm)
  })
  adjust_required_disabled()
}

// Sets up required groups.
function setup_required_groups() {
  required_groups = Array.from(document.querySelectorAll(".required-group,.was-required-group"))
  required_groups.forEach((g) => {
    g.addEventListener("change", on_required_group_change)
  })
}

// Sets the properties of an input that only need to be set once on startup.
// These include placeholder, title, shift-click handler for radio buttons.
function setup_input_once(input) {
  if (!input.placeholder) {
    for (var s in standardAttributes) {
      if (input.classList.contains(s)) {
        var placeholder = standardAttributes[s]?.placeholder
        if (placeholder) input.placeholder = placeholder
        var cleanup = standardAttributes[s]?.cleanupHandler
        if (cleanup) input.addEventListener('change', evt => {
          cleanup(evt)
          adjust_submit()
        })
      }
    }
  }
  if (!input.title && input.placeholder) {
    input.title = input.placeholder
  }
  if (input.type == "radio") {
    input.addEventListener("click", (evt) => {
      if (evt.shiftKey && !input.required) input.checked = false
    })
  }
}

function setup_buttons() {
  document.getElementById("submit").addEventListener("click", on_submit)
  document.getElementById("reset").addEventListener("click", on_reset)
  const save = document.getElementById("save")
  if (save) save.addEventListener("click", on_submit)
}

function set_initial_focus() {
  const invalid = document.querySelector('input:invalid,select:invalid,textarea:invalid')
  if (invalid) invalid.focus()
}

window.addEventListener("load", function () {
  the_form = document.getElementById("the-form")
  setup_comboboxes()
  setup_hidden_until()
  setup_required_if()
  setup_required_groups()
  array_for_each(the_form.elements, setup_input_once)
  setup_buttons()
  the_form.addEventListener("input", on_form_input)
  reset_form()
  set_initial_focus()
})
