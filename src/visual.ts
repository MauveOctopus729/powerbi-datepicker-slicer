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

        // Date picker
        this.datePicker = document.createElement("input");
        this.datePicker.type = "date";
        this.applyDatePickerStyles(this.datePicker);
        this.datePicker.addEventListener("change", () => this.onDatePickerChange());
        this.container.appendChild(this.datePicker);
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

        const objects = dataView.metadata?.objects;
        const generalProps = objects?.["general"] as any;
        const styleProps = objects?.["style"] as any;

        const earliestLabel: string = generalProps?.earliestLabel ?? "Earliest Date";
        const latestLabel: string = generalProps?.latestLabel ?? "Latest Date";
        this.dateFormat = generalProps?.dateFormat ?? "dd/MM/yyyy";

        const fontFamily: string = styleProps?.fontFamily ?? "'Segoe UI'";
        const fontSize: number = styleProps?.fontSize ?? 12;
        const fontColor: string = (styleProps?.fontColor as any)?.solid?.color ?? "#333";
        const accentColor: string = (styleProps?.accentColor as any)?.solid?.color ?? "#4C78A8";
        const bgColor: string = (styleProps?.backgroundColor as any)?.solid?.color ?? "transparent";

        this.applyVisualStyles(fontFamily, fontSize, fontColor, accentColor, bgColor);

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

        // Default to latest date
        if(!this.selectedDate && this.bookmarks.length >= 2)
        {
            this.selectedDate = this.bookmarks[1].date;
            this.dropdown.value = "1";
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

    private applyVisualStyles(
        fontFamily: string,
        fontSize: number,
        fontColor: string,
        accentColor: string,
        bgColor: string
    ): void
    {
        this.container.style.fontFamily = fontFamily;
        this.container.style.color = fontColor;
        this.container.style.backgroundColor = bgColor;

        this.dropdown.style.fontSize = `${fontSize}px`;
        this.dropdown.style.color = fontColor;
        this.dropdown.style.borderColor = accentColor;

        this.datePicker.style.fontSize = `${fontSize}px`;
        this.datePicker.style.color = fontColor;
        this.datePicker.style.borderColor = accentColor;

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