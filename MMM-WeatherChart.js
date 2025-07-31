/* Magic Mirror
 * Module: MMM-WeatherChart
 *
 * By Tatsuma Matsuki
 * MIT Licensed.
 * Some code is borrowed from
 * https://github.com/roramirez/MagicMirror-Module-Template
 * https://github.com/sathyarajv/MMM-OpenmapWeather
 */

Module.register("MMM-WeatherChart", {
    defaults: {
        updateInterval: 10 * 60 * 1000,
        retryDelay: 5000,
        apiBase: "https://api.openweathermap.org/data/",
        apiVersion: "3.0",
        apiEndpoint: "onecall",
        apiKey: "",
        lat: "",
        lon: "",
        units: "standard",
        lang: "en",
        chartjsVersion: "3.9.1",
        chartjsDatalabelsVersion: "2.2.0",
        height: "400px",
        width: "450px",
        fontSize: 16,
        fontWeight: "bold",
        dataNum: 24,
        timeOffsetHours: 0,
        title: "Weather Forecast",
        iconURLBase: "modules/MMM-WeatherChart/icons/", // "https://openweathermap.org/img/wn/",
        dataType: "hourly",
        nightBorderDash: [5, 1],
        pressureBorderDash: [5, 1],
        showIcon: false,
        showPressure: false,
        showRain: false,
        showZeroRain: true,
        rainUnit: "mm",
        rainMinHeight: 0.01,
        includeSnow: false,
        showSnow: false,
        showZeroSnow: true,
        color: "rgba(255, 255, 255, 1)",
        colorMin: "rgba(255, 255, 255, 1)",
        colorMax: "rgba(255, 255, 255, 1)",
        colorRain: "rgba(255, 255, 255, 1)",
        colorSnow: "rgba(255, 255, 255, 1)",
        colorPressure: "rgba(255, 255, 255, 1)",
        backgroundColor: "rgba(0, 0, 0, 0)",
        fillColor: "rgba(255, 255, 255, 0.1)",
        dailyLabel: "date",
        hourFormat: "24h",
        curveTension: 0.4,
        datalabelsDisplay: true,
        datalabelsOffset: 4,
        datalabelsRoundDecimalPlace: 1,
        precipitationRoundDecimalPlace: 2,
        largeOpenWeatherIcon: false,
        showPop: false,
        colorPop: "rgba(255, 255, 255, 1)",
        popRowHeight: 20,
        showWind: false,
        colorWind: "rgba(255, 255, 255, 1)",
        windRowHeight: 20,
        windUnit: "auto", // "auto", "mph", "km/h", "m/s", "knots"
        showUvi: false,
        colorUvi: "rgba(255, 255, 255, 1)",
        uviRowHeight: 20,
    },

    requiresVersion: "2.15.0",

    start: function () {
        var self = this;
        var dataRequest = null;
        var dataNotification = null;

        //Flag for check if module is loaded
        this.loaded = false;

        // Schedule update timer.
        this.getData();
        setInterval(function () {
            self.updateDom();
        }, this.config.updateInterval);
    },

    /*
     * getData
     * function example return data and show it in the module wrapper
     * get a URL request
     *
     */
    getData: function () {
        var self = this;

        if (this.config.apiKey === "") {
            Log.error(self.name + ": apiKey must be specified");
            return;
        }
        if (this.config.lat === "" && this.config.lon === "") {
            Log.error(self.name + ": location (lat and lon) must be specified");
            return;
        }

        var url =
            this.config.apiBase +
            this.config.apiVersion +
            "/" +
            this.config.apiEndpoint +
            this.getParams();
        var retry = true;

        fetch(url)
            .then((res) => {
                if (res.status == 401) {
                    retry = false;
                    throw new Error(self.name + ": apiKey is invalid");
                } else if (!res.ok) {
                    throw new Error(self.name + ": failed to get api response");
                }
                return res.json();
            })
            .then((json) => {
                self.processData(json);
            })
            .catch((msg) => {
                Log.error(msg);
            });
        if (retry) {
            self.scheduleUpdate(self.loaded ? -1 : self.config.retryDelay);
        }
    },

    getParams: function () {
        var params = "?";
        params += "lat=" + this.config.lat;
        params += "&lon=" + this.config.lon;
        params += "&units=" + this.config.units;
        params += "&lang=" + this.config.lang;
        params += "&appid=" + this.config.apiKey;

        return params;
    },

    getDayString: function (dateTime) {
        return dateTime
            .toLocaleString(moment.locale(), { weekday: "short" })
            .substring(0, 2);
    },

    getHourString: function (hour) {
        if (this.config.hourFormat == "12h") {
            let ampm = hour < 12 ? "am" : "pm";
            let h = hour % 12;
            h = h ? h : 12;
            return `${h}${ampm}`;
        } else {
            return hour;
        }
    },

    formatRain: function (rain) {
        if (this.config.rainUnit == "inch") {
            return rain / 25.4;
        }
        return rain;
    },

    formatWind: function (windSpeed, windDirection) {
        // API returns wind speed based on units parameter:
        // imperial: mph, metric: m/s, standard: m/s
        let convertedSpeed;
        if (this.config.windUnit === "auto") {
            // Use same unit system as main weather data
            if (this.config.units === "imperial") {
                convertedSpeed = windSpeed; // Already in mph
            } else if (this.config.units === "metric") {
                convertedSpeed = windSpeed * 3.6; // m/s to km/h
            } else {
                convertedSpeed = windSpeed; // standard (m/s)
            }
        } else if (this.config.windUnit === "mph") {
            if (this.config.units === "imperial") {
                convertedSpeed = windSpeed; // Already in mph
            } else {
                convertedSpeed = windSpeed * 2.237; // m/s to mph
            }
        } else if (this.config.windUnit === "km/h") {
            if (this.config.units === "imperial") {
                convertedSpeed = windSpeed * 1.609; // mph to km/h
            } else {
                convertedSpeed = windSpeed * 3.6; // m/s to km/h
            }
        } else if (this.config.windUnit === "knots") {
            if (this.config.units === "imperial") {
                convertedSpeed = windSpeed * 0.868; // mph to knots
            } else {
                convertedSpeed = windSpeed * 1.944; // m/s to knots
            }
        } else {
            // m/s requested
            if (this.config.units === "imperial") {
                convertedSpeed = windSpeed * 0.447; // mph to m/s
            } else {
                convertedSpeed = windSpeed; // Already m/s
            }
        }
        
        // Apply decimal precision using the general datalabels option
        let place = 10 ** this.config.datalabelsRoundDecimalPlace;
        let formattedSpeed = Math.round(convertedSpeed * place) / place;
        
        // Get wind direction
        let direction = this.getWindDirection(windDirection);
        
        return formattedSpeed + " " + direction;
    },

    getWindDirection: function (degrees) {
        // Unicode arrow directions - testing if font supports these glyphs
        const directions = ["↑", "↗", "↗", "↗", "→", "↘", "↘", "↘", 
                           "↓", "↙", "↙", "↙", "←", "↖", "↖", "↖"];
        return directions[Math.round(degrees / 22.5) % 16];
    },

    getIconImage: function (iconId, callback) {
        let self = this;
        let iconImage = new Image();
        if (iconId) {
            if (this.config.largeOpenWeatherIcon) {
                iconImage.src = this.config.iconURLBase + iconId + "@2x.png";
            } else {
                iconImage.src = this.config.iconURLBase + iconId + ".png";
            }
            iconImage.width = 30;
            iconImage.height = 30;
        }
        return iconImage;
    },

    // Get min value from arrays including NaN value
    getMin: function (array) {
        let min;
        for (let i = 0, l = array.length; i < l; i++) {
            let n = array[i];
            if (!isNaN(n)) {
                if (min) {
                    min = Math.min(min, n);
                } else {
                    min = n;
                }
            }
        }
        return min;
    },

    // Get max value from arrays including NaN value
    getMax: function (array) {
        let max;
        for (let i = 0, l = array.length; i < l; i++) {
            let n = array[i];
            if (!isNaN(n)) {
                if (max) {
                    max = Math.max(max, n);
                } else {
                    max = n;
                }
            }
        }
        return max;
    },

    getPressureValue(hPa) {
        if (this.config.units == "imperial") {
            return hPa * 0.029529983071445; // return value as inHg
        } else {
            return hPa;
        }
    },

    /* scheduleUpdate()
     * Schedule next update.
     *
     * argument delay number - Milliseconds before next update.
     *  If empty, this.config.updateInterval is used.
     */
    scheduleUpdate: function (delay) {
        var nextLoad = this.config.updateInterval;
        if (typeof delay !== "undefined" && delay >= 0) {
            nextLoad = delay;
        }
        nextLoad = nextLoad;
        var self = this;
        setTimeout(function () {
            self.getData();
        }, nextLoad);
    },

    getHourlyDataset: function () {
        const self = this;
        const data = this.weatherdata.hourly;

        const temps = [],
            rains = [],
            snows = [],
            dayTemps = [],
            nightTemps = [],
            labels = [],
            iconIDs = [],
            pressures = [],
            pops = [],
            windSpeeds = [],
            windDirections = [],
            uvis = [];

        data.sort(function (a, b) {
            if (a.dt < b.dt) return -1;
            if (a.dt > b.dt) return 1;
            return 0;
        });
        let dayTime;
        for (let i = 0; i < Math.min(this.config.dataNum, data.length); i++) {
            pressures.push(this.getPressureValue(data[i].pressure));

            let dateTime = new Date(
                data[i].dt * 1000 + this.config.timeOffsetHours * 60 * 60 * 1000
            );
            let iconID = data[i].weather[0].icon;
            let temp = data[i].temp;
            if (i === 0) {
                dayTime = Boolean(iconID.match(/d$/));
            }
            labels.push(this.getHourString(dateTime.getHours()));
            if (iconID.match(/d$/)) {
                dayTemps.push(temp);
                if (!dayTime) {
                    nightTemps.push(temp);
                } else {
                    nightTemps.push(NaN);
                }
                dayTime = true;
            }
            if (iconID.match(/n$/)) {
                nightTemps.push(temp);
                if (dayTime) {
                    dayTemps.push(temp);
                } else {
                    dayTemps.push(NaN);
                }
                dayTime = false;
            }
            temps.push(temp);
            if (data[i].rain) {
                if (data[i].snow && this.config.includeSnow) {
                    rains.push(
                        this.formatRain(data[i].rain["1h"] + data[i].snow["1h"])
                    );
                } else {
                    rains.push(this.formatRain(data[i].rain["1h"]));
                }
            } else {
                if (data[i].snow && this.config.includeSnow) {
                    rains.push(this.formatRain(data[i].snow["1h"]));
                } else {
                    rains.push(0);
                }
            }
            if (data[i].snow) {
                snows.push(this.formatRain(data[i].snow["1h"]));
            } else {
                snows.push(0);
            }
            iconIDs.push(iconID);
            pops.push(data[i].pop !== undefined ? data[i].pop : null); // precipitation probability (0-1) or null if missing
            windSpeeds.push(data[i].wind_speed || 0);
            windDirections.push(data[i].wind_deg || 0);
            uvis.push(data[i].uvi !== undefined ? data[i].uvi : null);
        }

        const minTemp = this.getMin(temps),
            maxTemp = this.getMax(temps),
            maxRain = this.getMax(rains),
            maxSnow = this.getMax(snows),
            maxPressure = this.getMax(pressures),
            minPressure = this.getMin(pressures),
            iconLine = [],
            icons = [],
            popLine = [],
            windLine = [],
            uviLine = [];

        let showRainSnow = false;
        if (this.config.showRain || this.config.showSnow) {
            if (
                this.config.showZeroRain ||
                maxRain > 0 ||
                this.config.showZeroSnow ||
                maxSnow > 0
            ) {
                showRainSnow = true;
            }
        }
        const iconSize = 25;  // this may not be the true pixel size of the icon
        const fontSize = 16; 
        const possibleRainShowPlotPercentage = 0.4; // percentage of the plot area that is used for rain/snow data  

        const topAreaInPixels = 
            (this.config.showIcon ? (iconSize*1.0 + fontSize * 0.5) : 0)
            + (this.config.showPop ? fontSize * 1.5 : 0)
            + (this.config.showWind ? fontSize * 1.5 : 0)
            + (this.config.showUvi ? fontSize * 1.5 : 0)
            + (fontSize * 2.0);  // always allow for the high temp data labels on top

        const bottomAreaInPixels = fontSize * 2.0;

        console.log("[jc] height " + parseInt(this.config.height));

        const plotAreaSizeInPixels = parseInt(this.config.height) - topAreaInPixels - bottomAreaInPixels;
        const temperatureRainBufferInPixels = showRainSnow ? fontSize * 4.0 : 0.0;
        const rainAreaPlotAreaPercentage = showRainSnow ? possibleRainShowPlotPercentage : 0.0;

        console.log("[jc] topAreaInPixels " + topAreaInPixels);
        console.log("[jc] bottomAreaInPixels " + bottomAreaInPixels);
        console.log("[jc] plotAreaSizeInPixels " + plotAreaSizeInPixels);
        console.log("[jc] temperatureRainBufferInPixels " + temperatureRainBufferInPixels);

        // range of the y axis given temperature and a buffer for rain/snow
        const temperatureAxisRange = ((maxTemp - minTemp) * plotAreaSizeInPixels) / (plotAreaSizeInPixels - temperatureRainBufferInPixels - plotAreaSizeInPixels * rainAreaPlotAreaPercentage);

        console.log("[jc] minTemp " + minTemp);
        console.log("[jc] maxTemp " + maxTemp);
        console.log("[jc] temperatureAxisRange " + temperatureAxisRange);

        calculatedMin = maxTemp - temperatureAxisRange;
        calculatedMax = calculatedMin + temperatureAxisRange * (1 + (topAreaInPixels / plotAreaSizeInPixels));

        const PixelsToAxisUnits = temperatureAxisRange / plotAreaSizeInPixels;

        console.log("[jc] calculatedMin " + calculatedMin);
        console.log("[jc] calculatedMax " + calculatedMax);


        console.log("[jc] calculatedMax " + calculatedMax);
        let currentY = calculatedMax;
        const iconY = this.config.showIcon ? currentY - (iconSize * 0.5 * PixelsToAxisUnits) : null;  // this is center line
        console.log("[jc] iconY " + iconY);
        if (this.config.showIcon) {
            currentY = iconY;
            currentY -=  ((iconSize * 0.5 + fontSize * 0.5) * PixelsToAxisUnits);  // next thing can start quarter text line below
        }
        console.log("[jc] currentY after icon " + currentY);
        
        // Position pop below icons if enabled
        const popY = this.config.showPop ? currentY - (fontSize * 0.5 * PixelsToAxisUnits) : null; // remember this is center
        if (this.config.showPop) {
            currentY = popY;
            currentY -= (fontSize * 1.0 * PixelsToAxisUnits); 
        }
        console.log("[jc] currentY after pop " + currentY);
        
        // Position wind below pop if enabled
        const windY = this.config.showWind ? currentY - (fontSize * 0.5 * PixelsToAxisUnits) : null;
        if (this.config.showWind) {
            currentY = windY;
            currentY -= (fontSize * 1.0 * PixelsToAxisUnits); 
        }
        
        // Position UV Index below wind if enabled
        const uviY = this.config.showUvi ? currentY - (fontSize * 0.5 * PixelsToAxisUnits) : null;

        // Create dummy line for icons (only if enabled)
        if (this.config.showIcon) {
            for (let i = 0; i < temps.length; i++) {
                iconLine.push(iconY);
                icons.push(this.getIconImage(iconIDs[i]));
            }
        }

        // Create dummy line for precipitation probability (only if enabled)
        if (this.config.showPop) {
            for (let i = 0; i < temps.length; i++) {
                popLine.push(popY);
            }
        }

        // Create dummy line for wind (only if enabled)
        if (this.config.showWind) {
            for (let i = 0; i < temps.length; i++) {
                windLine.push(windY);
            }
        }

        // Create dummy line for UV Index (only if enabled)
        if (this.config.showUvi) {
            for (let i = 0; i < temps.length; i++) {
                uviLine.push(uviY);
            }
        }

        const datasets = [];
        datasets.push({
            label: "Day Temparature",
            borderColor: this.config.color,
            pointBackgroundColor: this.config.color,
            datalabels: {
                color: this.config.color,
                align: "top",
                offset: this.config.datalabelsOffset,
                display: this.config.datalabelsDisplay,
                formatter: function (value) {
                    let place = 10 ** self.config.datalabelsRoundDecimalPlace;
                    let label = Math.round(value * place) / place;
                    return label;
                },
            },
            data: dayTemps,
            yAxisID: "y1",
        });
        datasets.push({
            label: "Night Temparature",
            borderColor: this.config.color,
            pointBackgroundColor: this.config.color,
            borderDash: this.config.nightBorderDash,
            datalabels: {
                color: this.config.color,
                align: "top",
                offset: this.config.datalabelsOffset,
                display: this.config.datalabelsDisplay,
                formatter: function (value) {
                    let place = 10 ** self.config.datalabelsRoundDecimalPlace;
                    let label = Math.round(value * place) / place;
                    return label;
                },
            },
            data: nightTemps,
            yAxisID: "y1",
        });
        if (this.config.showPressure) {
            datasets.push({
                label: "Pressure",
                borderColor: this.config.colorPressure,
                pointBackgroundColor: this.config.colorPressure,
                borderDash: this.config.pressureBorderDash,
                datalabels: {
                    color: this.config.color,
                    align: "top",
                    offset: this.config.datalabelsOffset,
                    display: this.config.datalabelsDisplay,
                    formatter: function (value) {
                        let place =
                            10 ** self.config.datalabelsRoundDecimalPlace;
                        let label = Math.round(value * place) / place;
                        return label;
                    },
                },
                data: pressures,
                //pointStyle: "star",
                //fill: true,
                yAxisID: "y3",
            });
        }
        if (this.config.showIcon) {
            datasets.push({
                label: "Icons",
                borderWidth: 0,
                data: iconLine,
                pointStyle: icons,
                datalabels: {
                    display: false,
                },
                yAxisID: "y1",
            });
        }
        if (this.config.showPop) {
            datasets.push({
                label: "Precipitation Probability",
                borderWidth: 0,
                data: popLine,
                pointStyle: "rect",
                pointRadius: 0,
                datalabels: {
                    display: true,
                    color: this.config.colorPop,
                    align: "center",
                    offset: 0,
                    formatter: function (value, context) {
                        let popValue = pops[context.dataIndex];
                        if (popValue === null) return ""; // Don't show anything if data is missing
                        let percentage = Math.round(popValue * 100);
                        return percentage + "%";
                    },
                },
                yAxisID: "y1",
            });
        }
        if (this.config.showWind) {
            let self = this;
            datasets.push({
                label: "Wind Speed & Direction",
                borderWidth: 0,
                data: windLine,
                pointStyle: "rect",
                pointRadius: 0,
                datalabels: {
                    display: true,
                    color: this.config.colorWind,
                    align: "center",
                    offset: 0,
                    formatter: function (value, context) {
                        let windSpeedValue = windSpeeds[context.dataIndex];
                        let windDirectionValue = windDirections[context.dataIndex];
                        if (windSpeedValue === null) return ""; // Don't show anything if data is missing
                        return self.formatWind(windSpeedValue, windDirectionValue);
                    },
                },
                yAxisID: "y1",
            });
        }
        if (this.config.showUvi) {
            let self = this;
            datasets.push({
                label: "UV Index",
                borderWidth: 0,
                data: uviLine,
                pointStyle: "rect",
                pointRadius: 0,
                datalabels: {
                    display: true,
                    color: this.config.colorUvi,
                    align: "center",
                    offset: 0,
                    formatter: function (value, context) {
                        let uviValue = uvis[context.dataIndex];
                        if (uviValue === null) return ""; // Don't show anything if data is missing
                        let place = 10 ** self.config.datalabelsRoundDecimalPlace;
                        return Math.round(uviValue * place) / place;
                    },
                },
                yAxisID: "y1",
            });
        }
        if (this.config.showRain) {
            if (this.config.showZeroRain || maxRain > 0) {
                datasets.push({
                    label: "Rain Volume",
                    backgroundColor: this.config.fillColor,
                    borderColor: this.config.colorRain,
                    borderWidth: 1,
                    pointBackgroundColor: this.config.colorRain,
                    datalabels: {
                        color: this.config.colorRain,
                        align: "top",
                        offset: this.config.datalabelsOffset,
                        display: this.config.datalabelsDisplay,
                        formatter: function (value) {
                            let place =
                                10 ** self.config.precipitationRoundDecimalPlace;
                            let label = Math.round(value * place) / place;
                            return self.config.showZeroRain || value > 0
                                ? label
                                : "";
                        },
                    },
                    data: rains,
                    fill: true,
                    yAxisID: "y2",
                });
            }
        }
        if (this.config.showSnow) {
            if (this.config.showZeroSnow || maxSnow > 0) {
                datasets.push({
                    label: "Snow Volume",
                    backgroundColor: this.config.fillColor,
                    borderColor: this.config.colorSnow,
                    borderWidth: 1,
                    pointBackgroundColor: this.config.colorSnow,
                    datalabels: {
                        color: this.config.color,
                        display: this.config.showRain ? false : true,
                        align: "top",
                        offset: this.config.datalabelsOffset,
                        display: this.config.datalabelsDisplay,
                        formatter: function (value) {
                            let place =
                                10 ** self.config.precipitationRoundDecimalPlace;
                            let label = Math.round(value * place) / place;
                            return self.config.showZeroSnow || value > 0
                                ? label
                                : "";
                        },
                    },
                    data: snows,
                    fill: true,
                    pointStyle: "star",
                    pointRadius: function (context) {
                        let value = context.dataset.data[context.dataIndex];
                        return value == 0 ? 3 : 6;
                    },
                    yAxisID: "y2",
                });
            }
        }

        let rainSnowPercentageOfWhole = (possibleRainShowPlotPercentage * temperatureAxisRange) / (calculatedMax - calculatedMin);
        console.log("[jc] rainSnowPercentageOfWhole " + rainSnowPercentageOfWhole);        

        let y2_max = Math.max(maxRain, maxSnow, this.config.rainMinHeight) * (1 / rainSnowPercentageOfWhole),
            y2_min = 0,
            y3_min = minPressure - (maxPressure - minPressure) * 0.1,
            y3_max =
                maxPressure +
                (maxPressure - minPressure);

        y1_max = calculatedMax;
        y1_min = calculatedMin;

        const ranges = {
            y1: {
                min: y1_min,
                max: y1_max,
            },
            y2: {
                min: y2_min,
                max: y2_max,
            },
            y3: {
                min: y3_min,
                max: y3_max,
            },
        };

        return { labels: labels, datasets: datasets, ranges: ranges };
    },

    getFontPixelHeight: function() {
        const testElement = document.createElement('div');
        testElement.style.position = 'absolute';
        testElement.style.visibility = 'hidden';
        testElement.style.fontSize = this.config.fontSize + 'px';
        testElement.style.fontFamily = window.getComputedStyle(document.body).fontFamily;
        testElement.style.lineHeight = 'normal';
        testElement.style.padding = '0';
        testElement.style.margin = '0';
        testElement.style.border = 'none';
        testElement.textContent = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%';
        
        document.body.appendChild(testElement);
        const height = testElement.offsetHeight;
        document.body.removeChild(testElement);
        
        // Check for CSS multipliers by comparing with computed styles
        const bodyComputedStyle = window.getComputedStyle(document.body);
        const bodyFontSize = parseFloat(bodyComputedStyle.fontSize);
        const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
        
        console.log("[jc] measured font height: " + height + " for fontSize: " + this.config.fontSize);
        console.log("[jc] body computed font size: " + bodyFontSize + "px");
        console.log("[jc] root font size: " + rootFontSize + "px");
        
        // If there's a significant difference, apply a multiplier
        const multiplier = bodyFontSize / this.config.fontSize;
        const adjustedHeight = height * multiplier;
        
        console.log("[jc] multiplier: " + multiplier + ", adjusted height: " + adjustedHeight);
        
        return adjustedHeight;
    },

    getDailyDataset: function () {
        const self = this;
        const data = this.weatherdata.daily;

        const maxTemps = [],
            minTemps = [],
            rains = [],
            snows = [],
            labels = [],
            iconIDs = [],
            pressures = [],
            pops = [],
            windSpeeds = [],
            windDirections = [],
            uvis = [];

        data.sort(function (a, b) {
            if (a.dt < b.dt) return -1;
            if (a.dt > b.dt) return 1;
            return 0;
        });
        for (let i = 0; i < Math.min(this.config.dataNum, data.length); i++) {
            pressures.push(this.getPressureValue(data[i].pressure));

            const dateTime = new Date(
                data[i].dt * 1000 + this.config.timeOffsetHours * 60 * 60 * 1000
            );
            if (this.config.dailyLabel == "date") {
                labels.push(dateTime.getDate());
            } else if (this.config.dailyLabel == "days_of_week") {
                labels.push(this.getDayString(dateTime));
            } else if (this.config.dailyLabel == "date+days_of_week") {
                labels.push(
                    this.getDayString(dateTime) + " " + dateTime.getDate()
                );
            }
            maxTemps.push(data[i].temp.max);
            minTemps.push(data[i].temp.min);
            if (data[i].rain) {
                if (data[i].snow && this.config.includeSnow) {
                    rains.push(this.formatRain(data[i].rain + data[i].snow));
                } else {
                    rains.push(this.formatRain(data[i].rain));
                }
            } else {
                if (data[i].snow && this.config.includeSnow) {
                    rains.push(this.formatRain(data[i].snow));
                } else {
                    rains.push(0);
                }
            }
            if (data[i].snow) {
                snows.push(this.formatRain(data[i].snow));
            } else {
                snows.push(0);
            }
            iconIDs.push(data[i].weather[0].icon);
            pops.push(data[i].pop !== undefined ? data[i].pop : null); // precipitation probability (0-1) or null if missing
            windSpeeds.push(data[i].wind_speed !== undefined ? data[i].wind_speed : null);
            windDirections.push(data[i].wind_deg !== undefined ? data[i].wind_deg : null);
            uvis.push(data[i].uvi !== undefined ? data[i].uvi : null);

        }

        const minValue = this.getMin(minTemps),
            maxValue = this.getMax(maxTemps),
            maxRain = this.getMax(rains),
            maxSnow = this.getMax(snows),
            iconLine = [],
            icons = [],
            popLine = [],
            windLine = [],
            uviLine = [];

        let showRainSnow = false;
        if (this.config.showRain || this.config.showSnow) {
            if (
                this.config.showZeroRain ||
                maxRain > 0 ||
                this.config.showZeroSnow ||
                maxSnow > 0
            ) {
                showRainSnow = true;
            }
        }

        const iconSize = 25;  // this may not be the true pixel size of the icon
        const fontSize = 16; 
        const possibleRainShowPlotPercentage = 0.4; // percentage of the plot area that is used for rain/snow data  

        console.log("[jc] iconSize " + iconSize);
        console.log("[jc] fontSize " + fontSize);

        const topAreaInPixels = 
            (this.config.showIcon ? (iconSize*1.0 + fontSize * 0.7) : 0)
            + (this.config.showPop ? fontSize * 1.5 : 0)
            + (this.config.showWind ? fontSize * 1.5 : 0)
            + (this.config.showUvi ? fontSize * 1.5 : 0)
            + (fontSize * 2.0);  // always allow for the high temp data labels on top

        const bottomAreaInPixels = fontSize * 2.0;

        console.log("[jc] height " + parseInt(this.config.height));

        const plotAreaSizeInPixels = parseInt(this.config.height) - topAreaInPixels - bottomAreaInPixels;
        const temperatureRainBufferInPixels = showRainSnow ? fontSize * 4.0 : 0.0;
        const rainAreaPlotAreaPercentage = showRainSnow ? possibleRainShowPlotPercentage : 0.0;

        console.log("[jc] topAreaInPixels " + topAreaInPixels);
        console.log("[jc] bottomAreaInPixels " + bottomAreaInPixels);
        console.log("[jc] plotAreaSizeInPixels " + plotAreaSizeInPixels);
        console.log("[jc] temperatureRainBufferInPixels " + temperatureRainBufferInPixels);

        // range of the y axis given temperature and a buffer for rain/snow
        const temperatureAxisRange = ((maxValue - minValue) * plotAreaSizeInPixels) / (plotAreaSizeInPixels - temperatureRainBufferInPixels - plotAreaSizeInPixels * rainAreaPlotAreaPercentage);

        console.log("[jc] minValue " + minValue);
        console.log("[jc] maxValue " + maxValue);
        console.log("[jc] temperatureAxisRange " + temperatureAxisRange);

        calculatedMin = maxValue - temperatureAxisRange;
        calculatedMax = calculatedMin + temperatureAxisRange * (1 + (topAreaInPixels / plotAreaSizeInPixels));

        const PixelsToAxisUnits = temperatureAxisRange / plotAreaSizeInPixels;

        console.log("[jc] calculatedMin " + calculatedMin);
        console.log("[jc] calculatedMax " + calculatedMax);
        console.log("[jc] PixelsToAxisUnits " + PixelsToAxisUnits);

        // Position icons at the top if enabled
        console.log("[jc] calculatedMax " + calculatedMax);
        let currentY = calculatedMax;
        const iconY = this.config.showIcon ? currentY - (iconSize * 0.5 * PixelsToAxisUnits) : null;  // this is center line
        console.log("[jc] iconY " + iconY);
        if (this.config.showIcon) {
            currentY = iconY;
            currentY -=  ((iconSize * 0.5 + fontSize * 0.5) * PixelsToAxisUnits);  // next thing can start quarter text line below
        }
        console.log("[jc] currentY after icon " + currentY);
        
        // Position pop below icons if enabled
        const popY = this.config.showPop ? currentY - (fontSize * 0.5 * PixelsToAxisUnits) : null; // remember this is center
        if (this.config.showPop) {
            currentY = popY;
            currentY -= (fontSize * 1.0 * PixelsToAxisUnits); 
        }
        console.log("[jc] currentY after pop " + currentY);
        
        // Position wind below pop if enabled
        const windY = this.config.showWind ? currentY - (fontSize * 0.5 * PixelsToAxisUnits) : null;
        if (this.config.showWind) {
            currentY = windY;
            currentY -= (fontSize * 1.0 * PixelsToAxisUnits); 
        }
        
        // Position UV Index below wind if enabled
        const uviY = this.config.showUvi ? currentY - (fontSize * 0.5 * PixelsToAxisUnits) : null;

        // Create dummy line for icons (only if enabled)
        if (this.config.showIcon) {
            for (let i = 0; i < minTemps.length; i++) {
                iconLine.push(iconY);
                icons.push(this.getIconImage(iconIDs[i]));
            }
        }

        // Create dummy line for precipitation probability (only if enabled)
        if (this.config.showPop) {
            for (let i = 0; i < minTemps.length; i++) {
                popLine.push(popY);
            }
        }

        // Create dummy line for wind (only if enabled)
        if (this.config.showWind) {
            for (let i = 0; i < minTemps.length; i++) {
                windLine.push(windY);
            }
        }

        // Create dummy line for UV Index (only if enabled)
        if (this.config.showUvi) {
            for (let i = 0; i < minTemps.length; i++) {
                uviLine.push(uviY);
            }
        }

        const datasets = [];
        datasets.push({
            label: "Minimum Temperature",
            borderColor: this.config.colorMin,
            pointBackgroundColor: this.config.colorMin,
            datalabels: {
                color: this.config.colorMin,
                align: "bottom",
                offset: this.config.datalabelsOffset,
                display: this.config.datalabelsDisplay,
                formatter: function (value) {
                    let place = 10 ** self.config.datalabelsRoundDecimalPlace;
                    let label = Math.round(value * place) / place;
                    return label;
                },
            },
            data: minTemps,
            yAxisID: "y1",
        });
        datasets.push({
            label: "Maximum Temperature",
            borderColor: this.config.colorMax,
            pointBackgroundColor: this.config.colorMax,
            datalabels: {
                color: this.config.colorMax,
                align: "top",
                offset: this.config.datalabelsOffset,
                display: this.config.datalabelsDisplay,
                formatter: function (value) {
                    let place = 10 ** self.config.datalabelsRoundDecimalPlace;
                    let label = Math.round(value * place) / place;
                    return label;
                },
            },
            data: maxTemps,
            yAxisID: "y1",
        });
        if (this.config.showPressure) {
            datasets.push({
                label: "Pressure",
                borderColor: this.config.colorPressure,
                pointBackgroundColor: this.config.colorPressure,
                borderDash: this.config.pressureBorderDash,
                datalabels: {
                    color: this.config.colorPressure,
                    align: "top",
                    offset: this.config.datalabelsOffset,
                    display: this.config.datalabelsDisplay,
                    formatter: function (value) {
                        let place =
                            10 ** self.config.datalabelsRoundDecimalPlace;
                        let label = Math.round(value * place) / place;
                        return label;
                    },
                },
                data: pressures,
                yAxisID: "y3",
            });
        }
        if (this.config.showIcon) {
            datasets.push({
                label: "Icons",
                borderWidth: 0,
                data: iconLine,
                pointStyle: icons,
                datalabels: {
                    display: false,
                },
                yAxisID: "y1",
            });
        }
        if (this.config.showPop) {
            datasets.push({
                label: "Precipitation Probability",
                borderWidth: 0,
                data: popLine,
                pointStyle: "rect",
                pointRadius: 0,
                datalabels: {
                    display: true,
                    color: this.config.colorPop,
                    align: "center",
                    offset: 0,
                    formatter: function (value, context) {
                        let popValue = pops[context.dataIndex];
                        if (popValue === null) return ""; // Don't show anything if data is missing
                        let percentage = Math.round(popValue * 100);
                        return percentage + "%";
                    },
                },
                yAxisID: "y1",
            });
        }
        if (this.config.showWind) {
            let self = this;
            datasets.push({
                label: "Wind Speed & Direction",
                borderWidth: 0,
                data: windLine,
                pointStyle: "rect",
                pointRadius: 0,
                datalabels: {
                    display: true,
                    color: this.config.colorWind,
                    align: "center",
                    offset: 0,
                    formatter: function (value, context) {
                        let windSpeedValue = windSpeeds[context.dataIndex];
                        let windDirectionValue = windDirections[context.dataIndex];
                        if (windSpeedValue === null) return ""; // Don't show anything if data is missing
                        return self.formatWind(windSpeedValue, windDirectionValue);
                    },
                },
                yAxisID: "y1",
            });
        }
        if (this.config.showUvi) {
            let self = this;
            datasets.push({
                label: "UV Index",
                borderWidth: 0,
                data: uviLine,
                pointStyle: "rect",
                pointRadius: 0,
                datalabels: {
                    display: true,
                    color: this.config.colorUvi,
                    align: "center",
                    offset: 0,
                    formatter: function (value, context) {
                        let uviValue = uvis[context.dataIndex];
                        if (uviValue === null) return ""; // Don't show anything if data is missing
                        let place = 10 ** self.config.datalabelsRoundDecimalPlace;
                        return Math.round(uviValue * place) / place;
                    },
                },
                yAxisID: "y1",
            });
        }
        if (this.config.showRain) {
            if (this.config.showZeroRain || maxRain > 0) {
                datasets.push({
                    label: "Rain Volume",
                    backgroundColor: this.config.fillColor,
                    borderColor: this.config.colorRain,
                    borderWidth: 1,
                    pointBackgroundColor: this.config.colorRain,
                    datalabels: {
                        color: this.config.colorRain,
                        align: "top",
                        offset: this.config.datalabelsOffset,
                        display: this.config.datalabelsDisplay,
                        formatter: function (value) {
                            let place =
                                10 ** self.config.precipitationRoundDecimalPlace;
                            let label = Math.round(value * place) / place;
                            return self.config.showZeroRain || value > 0
                                ? label
                                : "";
                        },
                    },
                    data: rains,
                    fill: true,
                    yAxisID: "y2",
                });
            }
        }
        if (this.config.showSnow) {
            if (this.config.showZeroSnow || maxSnow > 0) {
                datasets.push({
                    label: "Snow Volume",
                    backgroundColor: this.config.fillColor,
                    borderColor: this.config.colorSnow,
                    borderWidth: 1,
                    pointBackgroundColor: this.config.colorSnow,
                    datalabels: {
                        color: this.config.color,
                        display: this.config.showRain ? false : true,
                        align: "top",
                        offset: this.config.datalabelsOffset,
                        display: this.config.datalabelsDisplay,
                        formatter: function (value) {
                            let place =
                                10 ** self.config.precipitationRoundDecimalPlace;
                            let label = Math.round(value * place) / place;
                            return self.config.showZeroSnow || value > 0
                                ? label
                                : "";
                        },
                    },
                    data: snows,
                    fill: true,
                    pointStyle: "star",
                    pointRadius: function (context) {
                        let value = context.dataset.data[context.dataIndex];
                        return value == 0 ? 3 : 6;
                    },
                    yAxisID: "y2",
                });
            }
        }

        minPressure = this.getMin(pressures);
        maxPressure = this.getMax(pressures);

        let rainSnowPercentageOfWhole = (possibleRainShowPlotPercentage * temperatureAxisRange) / (calculatedMax - calculatedMin);
        console.log("[jc] rainSnowPercentageOfWhole " + rainSnowPercentageOfWhole);
        
        let y2_max = Math.max(maxRain, maxSnow, this.config.rainMinHeight) * (1 / rainSnowPercentageOfWhole),
            y2_min = 0,
            y3_min = minPressure - (maxPressure - minPressure) * 0.1,
            y3_max =
                maxPressure +
                (maxPressure - minPressure) ;

        console.log("[jc] y2_max " + y2_max);

        //if (showRainSnow) y1_min = y1_min - (maxValue - minValue) * 1.5;
        y1_max = calculatedMax;
        y1_min = calculatedMin;
        const ranges = {
            y1: {
                min: y1_min,
                max: y1_max,
            },
            y2: {
                min: y2_min,
                max: y2_max,
            },
            y3: {
                min: y3_min,
                max: y3_max,
            },
        };

        return { labels: labels, datasets: datasets, ranges: ranges };
    },

    getDom: function () {
        var self = this;

        const wrapper = document.createElement("div");
        wrapper.setAttribute(
            "style",
            "height: " +
                this.config.height +
                "; width: " +
                this.config.width +
                "; font-size: " +
                this.config.fontSize +
                "px; font-weight: " +
                this.config.fontWeight +
                ";"
        );
        if (this.weatherdata) {
            const wrapperCanvas = document.createElement("canvas"),
                ctx = wrapperCanvas.getContext("2d");

            let dataset;
            if (this.config.dataType === "hourly") {
                dataset = this.getHourlyDataset();
            } else if (this.config.dataType == "daily") {
                dataset = this.getDailyDataset();
            }

            // Get the actual font family from MagicMirror's body element
            const bodyStyle = window.getComputedStyle(document.body);
            const mmFontFamily = bodyStyle.fontFamily;
            
            Chart.defaults.font.family = mmFontFamily;
            Chart.defaults.font.size = this.config.fontSize;
            Chart.defaults.font.weight = this.config.fontWeight;
            Chart.defaults.color = this.config.color;
            Chart.register(ChartDataLabels);

            // Plugin for background color config
            // Refer:
            // https://www.chartjs.org/docs/latest/configuration/canvas-background.html#color
            const plugin = {
                id: "custom_canvas_background_color",
                beforeDraw: (chart) => {
                    const ctx = chart.canvas.getContext("2d");
                    ctx.save();
                    ctx.globalCompositeOperation = "destination-over";
                    ctx.fillStyle = this.config.backgroundColor;
                    ctx.fillRect(0, 0, chart.width, chart.height);
                    ctx.restore();
                },
            };

            if (this.chart) {
                this.chart.destroy();
            }
            this.chart = new Chart(ctx, {
                type: "line",
                data: {
                    labels: dataset.labels,
                    datasets: dataset.datasets,
                },
                plugins: [plugin],
                options: {
                    maintainAspectRatio: false,
                    responsive: true,
                    tension: this.config.curveTension,
                    title: {
                        display: true,
                        text: this.config.title,
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: this.config.title,
                            color: this.config.color,
                            font: {
                                size: this.config.fontSize,
                                weight: this.config.fontWeight
                            }
                        },
                        legend: {
                            display: false,
                        },
                    },
                    scales: {
                        x: {
                            position: "top",
                            grid: {
                                display: false,
                                borderWidth: 0,
                            },
                            clip: false,
                            offset: true,
                        },
                        y1: {
                            display: false,
                            grid: {
                                display: false,
                                color: 'rgba(255, 255, 255, 0.3)',
                            },
                            ticks: {
                                display: false,
                                color: 'rgba(255, 255, 255, 0.8)',
                            },
                            min: dataset.ranges.y1.min,
                            max: dataset.ranges.y1.max,
                        },
                        y2: {
                            display: false,
                            min: dataset.ranges.y2.min,
                            max: dataset.ranges.y2.max,
                        },
                        y3: {
                            display: false,
                            min: dataset.ranges.y3.min,
                            max: dataset.ranges.y3.max,
                        },
                    },
                    animation: { duration: 500 },
                },
            });
            this.chart.update();

            wrapper.appendChild(wrapperCanvas);
            
        }

        // Data from helper
        if (this.dataNotification) {
            var wrapperDataNotification = document.createElement("div");
            // translations  + datanotification
            wrapperDataNotification.innerHTML =
                "Updated at " + this.dataNotification.date;

            wrapper.appendChild(wrapperDataNotification);
        }
        return wrapper;
    },

    getScripts: function () {
        // Load chart.js from CDN
        let chartjsFileName = "chart.min.js";
        if (Number(this.config.chartjsVersion.split(".")[0]) < 3) {
            chartjsFileName = "Chart.min.js";
        }
        return [
            "https://cdn.jsdelivr.net/npm/chart.js@" +
                this.config.chartjsVersion +
                "/dist/" +
                chartjsFileName,
            "https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@" +
                this.config.chartjsDatalabelsVersion +
                "/dist/chartjs-plugin-datalabels.min.js",
        ];
    },

    getStyles: function () {
        return [];
    },

    getTranslations: function () {
        return false;
    },

    processData: function (data) {
        var self = this;
        this.weatherdata = data;
        if (this.loaded === false) {
            self.updateDom(self.config.animationSpeed);
        }
        this.loaded = true;

        // the data if load
        // send notification to helper
        this.sendSocketNotification("MMM-WeatherChart-NOTIFICATION", data);
    },

    // socketNotificationReceived from helper
    socketNotificationReceived: function (notification, payload) {
        if (notification === "MMM-WeatherChart-NOTIFICATION") {
            // set dataNotification
            this.dataNotification = payload;
            this.updateDom();
        }
    },
});
