"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;

import * as models from "powerbi-models";

import { VisualFormattingSettingsModel } from "./settings";

// ── Interfaces ──

interface DateBookmark
{
    label: string;
    date: Date;
    isAuto: boolean;
}

// ── Helpers ──

function toInputDate(d: Date): string
{
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function formatDate(d: Date, fmt: string): string
{
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();
    const monthNames =
    [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    switch (fmt)
    {
        case "MM/dd/yyyy":
            return `${String(month + 1).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
        case "yyyy-MM-dd":
            return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        case "dd MMM yyyy":
            return `${String(day).padStart(2, "0")} ${monthNames[month]} ${year}`;
        case "dd/MM/yyyy":
        default:
            return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
    }
}

function coerceToDate(value: any): Date | null
{
    if(value == null) return null;
    if(value instanceof Date) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

// ── Visual ──

export class Visual implements IVisual
{
    private host: IVisualHost;
    private container: HTMLElement;
    private dropdown: HTMLSelectElement;
    private datePicker: HTMLInputElement;
    private bookmarks: DateBookmark[] = [];
    private selectedDate: Date | null = null;
    private filterTarget: models.IFilterColumnTarget | null = null;
    private dateFormat: string = "dd/MM/yyyy";
    private styleTag: HTMLStyleElement;
    private datePickerWrapper: HTMLElement;
    private calendarIcon: SVGSVGElement;

    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    constructor(options: VisualConstructorOptions)
    {
        this.host = options.host;
        this.container = options.element;
        this.formattingSettings = new VisualFormattingSettingsModel();
        this.formattingSettingsService = new FormattingSettingsService();

        // Build DOM
        this.container.style.display = "flex";
        this.container.style.flexDirection = "column";
        this.container.style.padding = "6px";
        this.container.style.boxSizing = "border-box";
        this.container.style.overflow = "hidden";
        this.container.style.fontFamily = "Segoe UI";

        // Dropdown
        this.dropdown = document.createElement("select");
        this.applyDropdownStyles(this.dropdown);
        this.dropdown.addEventListener("change", () => this.onDropdownChange());
        this.container.appendChild(this.dropdown);

        // Date picker wrapper
        this.datePickerWrapper = document.createElement("div");
        this.datePickerWrapper.style.position = "relative";
        this.datePickerWrapper.style.width = "100%";

        this.datePicker = document.createElement("input");
        this.datePicker.type = "date";
        this.applyDatePickerStyles(this.datePicker);
        this.datePicker.addEventListener("change", () => this.onDatePickerChange());
        this.datePickerWrapper.appendChild(this.datePicker);

        // Custom calendar icon
        this.calendarIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.calendarIcon.setAttribute("viewBox", "0 0 24 24");
        this.calendarIcon.setAttribute("width", "14");
        this.calendarIcon.setAttribute("height", "14");
        this.calendarIcon.style.position = "absolute";
        this.calendarIcon.style.right = "8px";
        this.calendarIcon.style.top = "50%";
        this.calendarIcon.style.transform = "translateY(-50%)";
        this.calendarIcon.style.pointerEvents = "none";
        this.calendarIcon.innerHTML = `
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="2"/>
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2"/>
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2"/>
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/>
        `;
        this.datePickerWrapper.appendChild(this.calendarIcon);

        this.container.appendChild(this.datePickerWrapper);

        // Style tag for pseudo-element styling
        this.styleTag = document.createElement("style");
        this.container.appendChild(this.styleTag);
    }

    private applyDropdownStyles(el: HTMLSelectElement): void
    {
        el.style.width = "100%";
        el.style.padding = "5px 8px";
        el.style.marginBottom = "6px";
        el.style.border = "1px solid #ccc";
        el.style.borderRadius = "4px";
        el.style.fontSize = "12px";
        el.style.boxSizing = "border-box";
        el.style.cursor = "pointer";
        el.style.backgroundColor = "#fff";
    }

    private applyDatePickerStyles(el: HTMLInputElement): void
    {
        el.style.width = "100%";
        el.style.padding = "5px 8px";
        el.style.border = "1px solid #ccc";
        el.style.borderRadius = "4px";
        el.style.fontSize = "12px";
        el.style.boxSizing = "border-box";
    }

    public update(options: VisualUpdateOptions): void
    {
        if(!options || !options.dataViews || options.dataViews.length === 0)
        {
            this.clearVisual();
            return;
        }

        const dataView: DataView = options.dataViews[0];

        // Read formatting
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel, dataView
        );

        const earliestLabel: string = this.formattingSettings.generalSettings.earliestLabel.value || "Earliest Date";
        const latestLabel: string = this.formattingSettings.generalSettings.latestLabel.value || "Latest Date";
        this.dateFormat = (this.formattingSettings.generalSettings.dateFormat.value?.value as string) ?? "dd/MM/yyyy";

        const fontFamily: string = this.formattingSettings.styleSettings.fontFamily.value;
        const fontSize: number = this.formattingSettings.styleSettings.fontSize.value;
        const fontColor: string = this.formattingSettings.styleSettings.fontColor.value.value;
        const accentColor: string = this.formattingSettings.styleSettings.accentColor.value.value;
        const bgColor: string = this.formattingSettings.styleSettings.backgroundColor.value.value;
        const transparentBg: boolean = this.formattingSettings.styleSettings.transparentBackground.value;
        const inputBgColor: string = this.formattingSettings.styleSettings.inputBackgroundColor.value.value;
        const transparentInputBg: boolean = this.formattingSettings.styleSettings.transparentInputBackground.value;

        this.applyVisualStyles(fontFamily, fontSize, fontColor, accentColor, bgColor, transparentBg, inputBgColor, transparentInputBg);

        // Extract date column
        const categorical = dataView.categorical;
        if(!categorical || !categorical.categories || categorical.categories.length === 0)
        {
            this.clearVisual();
            return;
        }

        const dateCategory = categorical.categories[0];
        const dateValues: Date[] = [];
        for(const val of dateCategory.values)
        {
            const d = coerceToDate(val);
            if (d) dateValues.push(d);
        }

        if (dateValues.length === 0)
        {
            this.clearVisual();
            return;
        }

        // Build filter target
        const dateSource = dateCategory.source;
        this.filterTarget =
        {
            table: dateSource.queryName.split(".")[0],
            column: dateSource.displayName
        };

        const minDate = new Date(Math.min(...dateValues.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dateValues.map(d => d.getTime())));

        // Build bookmarks
        this.bookmarks = [];

        this.bookmarks.push(
        {
            label: `${earliestLabel} - ${formatDate(minDate, this.dateFormat)}`,
            date: minDate,
            isAuto: true
        });

        this.bookmarks.push(
        {
            label: `${latestLabel} - ${formatDate(maxDate, this.dateFormat)}`,
            date: maxDate,
            isAuto: true
        });

        if (categorical.values)
        {
            for(const valueColumn of categorical.values)
            {
                const measureName = valueColumn.source.displayName;
                const rawVal = valueColumn.values?.[0];
                const d = coerceToDate(rawVal);
                if(d)
                {
                    this.bookmarks.push(
                    {
                        label: `${measureName} - ${formatDate(d, this.dateFormat)}`,
                        date: d,
                        isAuto: false
                    });
                }
            }
        }

        // Populate dropdown
        this.dropdown.innerHTML = "";

        const customOpt = document.createElement("option");
        customOpt.value = "__custom__";
        customOpt.textContent = "- Pick from calendar -";
        this.dropdown.appendChild(customOpt);

        for(let i = 0; i < this.bookmarks.length; i++)
        {
            const opt = document.createElement("option");
            opt.value = String(i);
            opt.textContent = this.bookmarks[i].label;
            this.dropdown.appendChild(opt);
        }

        // Check for existing filter (e.g. from a bookmark restore)
        const existingFilter = this.getExistingFilter(options);

        if(existingFilter)
        {
            this.selectedDate = existingFilter;
        }
        else if(!this.selectedDate && this.bookmarks.length >= 2)
        {
            this.selectedDate = this.bookmarks[1].date;
        }

        // Sync dropdown to match selected date
        if(this.selectedDate)
        {
            let matchedIdx = -1;
            const selectedStr = toInputDate(this.selectedDate);
            for(let i = 0; i < this.bookmarks.length; i++)
            {
                if(toInputDate(this.bookmarks[i].date) === selectedStr)
                {
                    matchedIdx = i;
                    break;
                }
            }
            this.dropdown.value = matchedIdx >= 0 ? String(matchedIdx) : "__custom__";
        }

        if(this.selectedDate)
        {
            this.datePicker.value = toInputDate(this.selectedDate);
            this.datePicker.min = toInputDate(minDate);
            this.datePicker.max = toInputDate(maxDate);
        }

        this.applyFilter();
    }

    private onDropdownChange(): void
    {
        const val = this.dropdown.value;
        if(val === "__custom__") return;

        const idx = parseInt(val, 10);
        if(idx >= 0 && idx < this.bookmarks.length)
        {
            this.selectedDate = this.bookmarks[idx].date;
            this.datePicker.value = toInputDate(this.selectedDate);
            this.applyFilter();
        }
    }

    private onDatePickerChange(): void
    {
        const val = this.datePicker.value;
        if(!val) return;

        this.selectedDate = new Date(val + "T00:00:00");

        let matchedIdx = -1;
        for(let i = 0; i < this.bookmarks.length; i++)
        {
            if(toInputDate(this.bookmarks[i].date) === val)
            {
                matchedIdx = i;
                break;
            }
        }

        this.dropdown.value = matchedIdx >= 0 ? String(matchedIdx) : "__custom__";
        this.applyFilter();
    }

    private applyFilter(): void
    {
        if(!this.selectedDate || !this.filterTarget) return;

        const filter = new models.BasicFilter(
            this.filterTarget,
            "In",
            [this.selectedDate.toISOString()]
        );

        this.host.applyJsonFilter(
            filter,
            "general",
            "filter",
            powerbi.FilterAction.merge
        );
    }

    private clearFilter(): void
    {
        this.host.applyJsonFilter(
            null,
            "general",
            "filter",
            powerbi.FilterAction.remove
        );
    }

    private getExistingFilter(options: VisualUpdateOptions): Date | null
    {
        const filters = options.jsonFilters as models.BasicFilter[];
        if(!filters || filters.length === 0) return null;

        const filter = filters[0];
        if(filter && filter.values && filter.values.length > 0)
        {
            const d = coerceToDate(filter.values[0]);
            return d;
        }
        return null;
    }

    private applyVisualStyles(
        fontFamily: string,
        fontSize: number,
        fontColor: string,
        accentColor: string,
        bgColor: string,
        transparentBg: boolean,
        inputBgColor: string,
        transparentInputBg: boolean
    ): void
    {
        this.container.style.fontFamily = fontFamily;
        this.container.style.color = fontColor;
        this.container.style.backgroundColor = transparentBg ? "transparent" : bgColor;

        this.dropdown.style.fontSize = `${fontSize}px`;
        this.dropdown.style.color = fontColor;
        this.dropdown.style.borderColor = accentColor;
        this.dropdown.style.fontFamily = fontFamily;

        this.datePicker.style.fontSize = `${fontSize}px`;
        this.datePicker.style.color = fontColor;
        this.datePicker.style.borderColor = accentColor;
        this.datePicker.style.fontFamily = fontFamily;

        const resolvedInputBg = transparentInputBg ? "transparent" : inputBgColor;
        this.dropdown.style.backgroundColor = resolvedInputBg;
        this.datePicker.style.backgroundColor = resolvedInputBg;

        // Style the calendar icon colour
        this.styleTag.textContent = `
            input[type="date"]::-webkit-calendar-picker-indicator {
                opacity: 0;
                position: absolute;
                right: 0;
                width: 30px;
                height: 100%;
                cursor: pointer;
            }
        `;

        this.calendarIcon.style.color = fontColor;
        const iconSize = Math.max(fontSize - 2, 10);
        this.calendarIcon.setAttribute("width", String(iconSize));
        this.calendarIcon.setAttribute("height", String(iconSize));
    }

    private getIconFilter(hexColor: string): string
    {
        // For dark colours, no filter needed (icon is dark by default)
        // For light colours, invert the icon
        const hex = hexColor.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;

        if(brightness > 180)
        {
            return "invert(1) brightness(2)";
        }
        else if(brightness > 80)
        {
            return "invert(0.5)";
        }
        return "none";
    }

    private clearVisual(): void
    {
        this.dropdown.innerHTML = "";
        this.datePicker.value = "";
        this.bookmarks = [];
        this.selectedDate = null;
        this.clearFilter();
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel
    {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}