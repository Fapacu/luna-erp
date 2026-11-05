(() => {
    const fieldSelector = [
        'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="image"])',
        "select",
    ].join(",");

    function isVisible(element) {
        return element.getClientRects().length > 0
            && getComputedStyle(element).visibility !== "hidden";
    }

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.defaultPrevented
            || event.isComposing || event.altKey || event.ctrlKey
            || event.metaKey || event.shiftKey) {
            return;
        }

        const current = event.target;
        if (!(current instanceof HTMLElement)
            || !current.matches(fieldSelector)
            || current.matches("textarea, .input-scanner, #busquedaProducto")
            || current.dataset.enterNavigation === "off") {
            return;
        }

        const scope = current.closest(".modal-content, .filtros, form")
            || current.closest("main")
            || document;
        const fields = Array.from(scope.querySelectorAll(fieldSelector))
            .filter((field) => !field.disabled && isVisible(field));
        const currentIndex = fields.indexOf(current);
        const next = fields[currentIndex + 1];

        if (next) {
            event.preventDefault();
            next.focus();
        }
    });
})();
