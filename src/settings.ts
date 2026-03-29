"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

class GeneralSettings extends FormattingSettingsCard
{
    name: string = "general";
    displayName: string = "General";

    earliestLabel = new formattingSettings.TextInput(
    {
        name: "earliestLabel",
        displayName: "Earliest Date Label",
        placeholder: "Earliest Date",
        value: "Earliest Date"
    });

    latestLabel = new formattingSettings.TextInput(
    {
        name: "latestLabel",
        displayName: "Latest Date Label",
        placeholder: "Latest Date",
        value: "Latest Date"
    });

    dateFormat = new formattingSettings.ItemDropdown(
    {
        name: "dateFormat",
        displayName: "Date Display Format",
        items:
        [
            { value: "dd/MM/yyyy", displayName: "DD/MM/YYYY" },
            { value: "MM/dd/yyyy", displayName: "MM/DD/YYYY" },
            { value: "yyyy-MM-dd", displayName: "YYYY-MM-DD" },
            { value: "dd MMM yyyy", displayName: "DD MMM YYYY" }
        ],
        value: { value: "dd/MM/yyyy", displayName: "DD/MM/YYYY" }
    });

    slices: FormattingSettingsSlice[] =
    [
        this.earliestLabel,
        this.latestLabel,
        this.dateFormat
    ];
}

class StyleSettings extends FormattingSettingsCard
{
    name: string = "style";
    displayName: string = "Style";

    fontFamily = new formattingSettings.FontPicker(
    {
        name: "fontFamily",
        displayName: "Font Family",
        value: "Segoe UI"
    });

    fontSize = new formattingSettings.NumUpDown(
    {
        name: "fontSize",
        displayName: "Font Size",
        value: 12
    });

    fontColor = new formattingSettings.ColorPicker(
    {
        name: "fontColor",
        displayName: "Font Colour",
        value: { value: "#333333" }
    });

    accentColor = new formattingSettings.ColorPicker(
    {
        name: "accentColor",
        displayName: "Accent Colour",
        value: { value: "#4C78A8" }
    });

    backgroundColor = new formattingSettings.ColorPicker(
    {
        name: "backgroundColor",
        displayName: "Background Colour",
        value: { value: "#FFFFFF" }
    });

    transparentBackground = new formattingSettings.ToggleSwitch(
    {
        name: "transparentBackground",
        displayName: "Transparent Background",
        value: false
    });

    inputBackgroundColor = new formattingSettings.ColorPicker(
    {
        name: "inputBackgroundColor",
        displayName: "Input Background Colour",
        value: { value: "#FFFFFF" }
    });

    transparentInputBackground = new formattingSettings.ToggleSwitch(
    {
        name: "transparentInputBackground",
        displayName: "Transparent Input Background",
        value: false
    });

    slices: FormattingSettingsSlice[] =
    [
        this.transparentBackground,
        this.fontFamily,
        this.fontSize,
        this.fontColor,
        this.accentColor,
        this.backgroundColor,
        this.inputBackgroundColor,
        this.transparentInputBackground
    ];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel
{
    generalSettings = new GeneralSettings();
    styleSettings = new StyleSettings();

    cards: FormattingSettingsCard[] =
    [
        this.generalSettings,
        this.styleSettings
    ];
}