'use strict'
// Enables the reading of the file system.
const fs = require('fs');

// These are the global values for the function, i will hard code them as these are not stored in the save values so if they change this will need changing.
const PLAYABLE_FACTIONS = ['default'];
const FACTION_TRACKING = ["fallen_empire"].concat(PLAYABLE_FACTIONS);
const BASE_MARKET_VALUES = {
    mineral: { cost: 1, id: 2 },
    food: { cost: 1, id: 3 },
    consumer_goods: { cost: 2, id: 10 },
    alloys: { cost: 4, id: 9 },
    exotic_gas: { cost: 10, id: 12 },
    rare_crystal: { cost: 10, id: 13 },
    volatile_mote: { cost: 10, id: 11 },
    dark_matter: { cost: 20, id: 16 },
    living_metal: { cost: 20, id: 17 }, // This is an assumed value
    zro: { cost: 20, id: 15 }, // This is an assumed value
    nanites : {cost:50, id: 18} // This is an assumed value
};

// This is a list of sections of ships which indicate that they are not military ships.
const NON_FLEET_SECTIONS = [
    'STARBASE',
    'CONSTRUCTION',
    'STATION',
    'SCIENCESHIP'


];


/**
 * The save file is large so when passing it between machines sometimes its easier to split it into two. this merges the two. 
 * This should not be needed and is purely a development addition.
 */
function parseSplitJSON() {
    var str = fs.readFileSync('saveJSN1.txt', 'utf8');
    jsnP1 = JSON.parse(JSON.parse(str));
    var str2 = fs.readFileSync('saveJSN2.txt', 'utf8');
    jsnP2 = JSON.parse(JSON.parse(str2));
    for (key in jsnP2) {
        jsnP1[key] = jsnP2[key];
    }
    saveFile('saveJsn.txt', JSON.stringify(jsnP1));
    return str;
}

/**
 * The aim of this function is to get the monthly incomes of each country.
 * @param {Object} data This is the save file data to be mapped.
 */
function getIncomes(data) {
    let incomeByCountry = {};
    for (let country in data.country) {
        try {
            if (FACTION_TRACKING.indexOf(data.country[country].type) != -1) {
                incomeByCountry[country] = {};
                let countryIncome = data.country[country].budget.last_month.income;
                for (income in countryIncome) {
                    for (resource in countryIncome[income]) {
                        if (incomeByCountry[country][resource] == undefined) {
                            incomeByCountry[country][resource] = 0;
                        }
                        incomeByCountry[country][resource] += countryIncome[income][resource];
                    }
                }
            }
        }
        catch (err) {
        }
    }
    return incomeByCountry;
}

/**
 * The aim of this function is to get the current stockpiles of each country.
 * @param {Object} data This is the save file data to be mapped.
 */
function getStockpiles(data) {
    let balanceByCountry = {};
    for (let country in data.country) {
        try {
            if (FACTION_TRACKING.indexOf(data.country[country].type) != -1) {
                balanceByCountry[country] = data.country[country].modules.standard_economy_module.resources;
            }

        }
        catch (err) {
        }
    }
    return balanceByCountry;
}

/**
 * The aim of this function is to work out the total value of the items stored in a coutnries.
 * Stockpiles if every item was liquidated for the current market value.
 * @param {Object} data This is the save file data to be mapped.
 * @param {*} mappings 
 */
function totalMarketableResources(data, mappings) {
    let marketRate = {};
    mappings.totalStockpileValue = {};
    mappings.totalIncomeValue = {};

    for (let resource in BASE_MARKET_VALUES) {
        let flux = data.market.fluctuations[BASE_MARKET_VALUES[resource].id];
        marketRate[resource] = BASE_MARKET_VALUES[resource].cost * ((100 + flux) / 100);
    }
    for (let country in mappings.stockpiles) {
        mappings.totalStockpileValue[country] = 0;
        for (let resource in mappings.stockpiles[country]) {
            if (BASE_MARKET_VALUES[resource] != undefined) {
                mappings.totalStockpileValue[country] += marketRate[resource] * mappings.stockpiles[country][resource];
            }
        }
    }
    for (let country in mappings.income) {
        mappings.totalIncomeValue[country] = 0;
        for (let resource in mappings.income[country]) {
            if (BASE_MARKET_VALUES[resource] != undefined) {
                mappings.totalIncomeValue[country] += marketRate[resource] * mappings.income[country][resource];
            }
        }
    }
    return mappings;
}

/**
 * This function will work out a list of the armies and fleets of each country.
 * @param {Object} data This is the save file data to be mapped.
 * @param {Object} mapping This is the mappings file that we are ammending.
 */
function totalFleets(data, mapping) {
    let fleetByPlayer = {};
    let shipsByPlayer = {};
    let armiesByPlayer = {};
    let armyFleetsByPlayer = {};
    for (let fleet in data.fleet) {
        let tempFleet = data.fleet[fleet];

        for (let ship in tempFleet.ships) {
            let design = '';
            let tempShip = data.ships[tempFleet.ships[ship]];
            if (tempShip.section == undefined) {
                continue;
            }
            if (tempShip.section.design != undefined) {
                design = tempShip.section.design;
            }
            else {
                design = tempShip.section['0'].design;
            }
            let designSections = design.split('_');
            let allow = true;
            for (let element of designSections) {
                if (NON_FLEET_SECTIONS.indexOf(element) > -1) {
                    allow = false;
                }
            }
            if (allow) {
                if (fleetByPlayer[tempFleet.owner] == undefined) {
                    fleetByPlayer[tempFleet.owner] = {};
                    shipsByPlayer[tempFleet.owner] = {};
                }
                if (armiesByPlayer[tempFleet.owner] == undefined) {
                    armiesByPlayer[tempFleet.owner] = {};
                    armyFleetsByPlayer[tempFleet.owner] = {};
                }
                if (designSections.indexOf('TRANSPORT') > -1) {
                    armiesByPlayer[tempFleet.owner][tempFleet.ships[ship]] = tempShip;
                    armyFleetsByPlayer[tempFleet.owner][fleet] = tempFleet;
                }
                else {
                    shipsByPlayer[tempFleet.owner][tempFleet.ships[ship]] = tempShip;
                    fleetByPlayer[tempFleet.owner][fleet] = tempFleet; 
                }
            }
        }
    }
    mapping.fleetByPlayer = fleetByPlayer;
    mapping.shipsByPlayer = shipsByPlayer;
    mapping.armiesByPlayer = armiesByPlayer;
    mapping.armyFleetsByPlayer = armyFleetsByPlayer;
    saveFile('Output.json', JSON.stringify(mapping))
    return mapping;
}


/**
 * This is a temporary output of the JSON mapping File to be removed at a later date for a more useful save file.
 * @param {String} fileName This will be the filename that you wish to save the file under.
 * @param {Object} data This is the JSON object you wish to save the mapping file as.
 */
function saveFile(fileName, data) {
    return fs.writeFile(fileName, data, function (err, data) {
        if (err) {
            return console.log(err);
        }
        console.log(data);
    });
}

/**
 * This function takes the mapping of the fleets and then totals the power.
 * @param {Object} data This is the JSON object you wish to save the mapping file as.
 */
function totalFleetPower(data) {
    let output = {};
    for (let country in data.fleetByPlayer) {
        output[country] = 0;
        for(let ship in data.fleetByPlayer[country]){
            output[country] += data.fleetByPlayer[country][ship].military_power;
        }
    }
    return output;
}

/**
 * This function takes the mapping of the armies and then totals the power.
 * @param {Object} data This is the JSON object you wish to save the mapping file as.
 */
function totalArmyPower(data) {
    let output = {};
    for (let country in data.armyFleetsByPlayer) {
        output[country] = 0;
        for(let ship in data.armyFleetsByPlayer[country]){
            output[country] += data.armyFleetsByPlayer[country][ship].military_power;
        }
    }
    return output;
}


/** */
function getMegastructures(data){
    let megastructues = {};
    for (structure in data.megastructues){
        let temp = data.megastructues[structure];
        if(!megastructues[temp.owner]){
           megastructues[temp.owner] = {}; 
        }
        if(!megastructues[temp.owner][temp.type]){
            megastructues[temp.owner][temp.type] = 1;
        }
        else{
            megastructues[temp.owner][temp.type] += 1;
        }
    }
return ;
}




/**
 * This will pass the file to get this file i have used a parse written by jomini. 
 */
function parseFile() {
    //var jomini = require('jomini');
    //let data = jomini.parse(str);
    //var str = parseSplitJSON();
    var str = fs.readFileSync('jomini-master/jomini-master/savedata.txt','utf8');//'savedata.txt', 'utf8');
    return JSON.parse(str);
}


function main() {
    let jn = parseFile();
    let mappings = {};
    mappings.income = getIncomes(jn);
    mappings.stockpiles = getStockpiles(jn);
    mappings = totalMarketableResources(jn, mappings);
    mappings = totalFleets(jn, mappings);
    mappings.totalFleetPower = totalFleetPower(mappings);
    mappings.totalArmyPower = totalArmyPower(mappings);
    mappings.megastructures = getMegastructures(jn);
    saveFile('output.txt', JSON.stringify(mappings));
    return mappings;
}

main();
