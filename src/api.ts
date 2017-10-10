import { UIExtensionExports, TemplateRule } from './'

type Maybe<T> = T | null

export default function(window: Window): UIExtensionExports {
    const menuSlider = window.document.querySelector('.nav-slider-container .nav-slider') as Element
    const toggleMenu = () => menuSlider.classList.toggle('is-active')
    for (let el of window.document.querySelectorAll('.nav-slider-toggle')) {
        el.addEventListener('click', toggleMenu)
    }

    let tabs = new Map<HTMLElement, HTMLElement>()

    const container = window.document.getElementById('container') as HTMLElement
    const menuContainer = window.document.querySelector('.nav-slider') as HTMLElement
    const addTab = (text: string, groupName?: string): HTMLDivElement => {
        let div = container.appendChild(window.document.createElement('div'))

        let parent = menuContainer
        if (groupName) parent = parent.querySelector(`[data-group="${parent}"]`) as HTMLElement

        let nav = parent.appendChild(window.document.createElement('span'))
        nav.textContent = text

        tabs.set(nav, div)
        return div
    }
    const removeTab = (content: HTMLDivElement) => {
        for (let [nav, div] of tabs.entries()) {
            if (div == content) {
                div.remove()
                nav.remove()
                return
            }
        }
    }

    const groups = new Map<string, HTMLElement>()

    const addTabGroup = (text: string, groupName: string, parent?: string) => {
        let details = groups.get(groupName)
        if (details) {
            details.children[0].textContent = text
            return
        }

        let parentElement = menuContainer
        if (parent) parentElement = menuContainer.querySelector(`[data-group="${parent}"]`) as HTMLElement
        details = parentElement.appendChild(window.document.createElement('details'))
        let summary = details.appendChild(window.document.createElement('summary'))
        summary.textContent = text
        groups.set(groupName, details)
    }

    const removeTabGroup = (groupName: string) => {
        let group = groups.get(groupName)
        if (!group) return
        for (let child of group.querySelectorAll('span')) {
            // Unless someone has been purposely messing with the page, this is a safe assertion
            removeTab(tabs.get(child) as HTMLDivElement)
        }
    }

    const handleRule = (rule: TemplateRule, element: HTMLElement) => {
        if (typeof rule.text == 'string') {
            element.textContent = rule.text
        } else if (typeof rule.html == 'string') {
            element.innerHTML = rule.html
        }

        let blacklist = ['text', 'html', 'selector']

        if (element instanceof HTMLTextAreaElement && 'value' in rule) {
            element.textContent = rule.value
            blacklist.push('value')
        }

        //See https://github.com/Blockheads-Messagebot/MessageBot/issues/52
        if (element instanceof HTMLSelectElement && 'value' in rule) {
            let child = element.querySelector(`[value="${rule.value}"]`) as Maybe<HTMLOptionElement>
            if (child) child.selected = true
        }

        Object.keys(rule)
            .filter(key => !blacklist.includes(key))
            .forEach(key => element.setAttribute(key, rule[key]))
    }

    const buildTemplate = (template: string | HTMLTemplateElement, target: string | HTMLElement, rules: TemplateRule[]) => {
        if (typeof template == 'string') template = window.document.querySelector(template) as HTMLTemplateElement
        if (typeof target == 'string') target = window.document.querySelector(target) as HTMLElement

        let parent = window.document.importNode(template.content, true)

        for (let rule of rules) {
            let element = parent.querySelector(rule.selector) as HTMLElement
            if (!element) {
                console.warn(`Could not find ${rule.selector}`, rule)
                continue
            }
            handleRule(rule, element)
        }
    }

    const notify = (text: string, displayTime: number = 3) => {
        let el = window.document.body.appendChild(window.document.createElement('div'))
        el.classList.add('bot-notification', 'is-active')
        el.textContent = text
        let timeouts = [
            setTimeout(() => el.classList.remove('is-active'), displayTime * 1000),
            setTimeout(() => el.remove(), (displayTime + 1) * 1000)
        ]
        el.addEventListener('click', () => {
            timeouts.forEach(clearTimeout)
            el.remove()
        })
    }

    interface alertItem {
        html: string,
        buttons?: Array<{text: string, style?: string} | string>,
        callback?: (s: string) => void
    }
    let alertInstance: {active: boolean, queue: alertItem[]} = {
        active: false,
        queue: []
    }
    const modal = window.document.getElementById('modal') as HTMLElement
    const modalBody = modal.querySelector('.modal-card-body') as HTMLElement
    const modalFooter = modal.querySelector('.modal-card-foot') as HTMLElement

    const addButton = (button: string | { text: string, style?: string }) => {
        let el = modalFooter.appendChild(window.document.createElement('a'))
        let styles = ['button']
        if (typeof button == 'object') {
            styles.push(button.style || '')
            el.textContent = button.text
        } else {
            el.textContent = button
        }
    }
    const showAlert = () => {
        alertInstance.active = true
        const {html, buttons, callback} = alertInstance.queue.shift() as alertItem
        modalBody.innerHTML = html

        Array.isArray(buttons) ? buttons.forEach(addButton) : addButton('OK')

        modal.classList.add('is-active')
        modalFooter.addEventListener('click', function buttonHandler(event) {
            let target = event.target as HTMLElement
            if (target.tagName != 'A') return

            modal.classList.remove('is-active')
            try {
                if (callback) callback.call(null, target.textContent)
            } catch (err) {
                console.error('Error calling alert callback', err)
            }
            modalFooter.innerHTML = ''
            modalFooter.removeEventListener('click', buttonHandler)
            alertInstance.active = false
            if (alertInstance.queue.length) showAlert()
        })
    }

    const alert = (html: string, buttons?: Array<{ text: string, style?: string } | string>, callback?: (text: string) => void): void => {
        alertInstance.queue.push({ html, buttons, callback})
        if (!alertInstance.active) showAlert()
    }

    const prompt = (text: string, callback?: (response: string) => void): void => {
        let p = window.document.createElement('p')
        p.textContent = text
        alert(p.outerHTML + `<textarea class="textarea"></textarea>`, ['OK', 'Cancel'], () => {
            let el = modalBody.querySelector('textarea') as HTMLTextAreaElement
            if (callback) callback(el.textContent || '')
        })
    }

    return {
        toggleMenu,
        addTab,
        removeTab,
        addTabGroup,
        removeTabGroup,
        buildTemplate,
        notify,
        alert,
        prompt
    }
}