'use strict'
// Enables the reading of the file system.
const fs = require('fs');

// These are the global values for the function, i will hard code them as these are not stored in the save values so if they change this will need changing.
const PLAYABLE_FACTIONS = ['default'];
const FACTION_TRACKING = ["fallen_empire"].concat(PLAYABLE_FACTIONS);
const BASE_MARKET_VALUES = {
    minerals: { cost: 1, id: 2 },
    food: { cost: 1, id: 3 },
    consumer_goods: { cost: 2, id: 10 },
    alloys: { cost: 4, id: 9 },
    exotic_gases: { cost: 10, id: 12 },
    rare_crystals: { cost: 10, id: 13 },
    volatile_motes: { cost: 10, id: 11 },
    sr_dark_matter: { cost: 20, id: 16 },
    living_metal: { cost: 20, id: 17 }, // This is an assumed value
    sr_zro: { cost: 20, id: 15 }, // This is an assumed value
    nanites: { cost: 50, id: 18 } // This is an assumed value
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
                for (let income in countryIncome) {
                    for (let resource in countryIncome[income]) {
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


//TODO: Add energy Credits
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
        let flux = 1
        if(data.market.fluctuations!== undefined){
            flux = data.market.fluctuations[BASE_MARKET_VALUES[resource].id];
        } 
        marketRate[resource] = BASE_MARKET_VALUES[resource].cost * ((100 + flux) / 100);
    }
    for (let country in mappings.stockpiles) {
        mappings.totalStockpileValue[country] = 0;
        for (let resource in mappings.stockpiles[country]) {
            if (BASE_MARKET_VALUES[resource] != undefined) {
                mappings.totalStockpileValue[country] += marketRate[resource] * mappings.stockpiles[country][resource];
            }
            else if (resource == 'energy') {
                mappings.totalStockpileValue[country] += mappings.stockpiles[country][resource];
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
    //saveFile('Output.json', JSON.stringify(mapping))
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
        for (let ship in data.fleetByPlayer[country]) {
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
        for (let ship in data.armyFleetsByPlayer[country]) {
            output[country] += data.armyFleetsByPlayer[country][ship].military_power;
        }
    }
    return output;
}


/** */
function getMegastructures(data) {
    let megastructures = {};
    for (let structure in data.megastructures) {
        let temp = data.megastructures[structure];
        if (!megastructures[temp.owner]) {
            megastructures[temp.owner] = {};
        }
        if (!megastructures[temp.owner][temp.type]) {
            megastructures[temp.owner][temp.type] = 1;
        }
        else {
            megastructures[temp.owner][temp.type] += 1;
        }
    }
    return megastructures;
}

/** */
function getPopData(data, mappings) {
    let popCount = {};
    let popsPerSpecies = {};
    let popHappiness = {};
    let popJobLevels = {};
    let popJobs = {}
    let popEthos = {};
    for (let pop in data.pop) {
        let tempPop = data.pop[pop];
        if (popsPerSpecies[tempPop.species_index] == undefined) {
            popsPerSpecies[tempPop.species_index] = {};
        }
        popsPerSpecies[tempPop.species_index][pop] = tempPop;
        if (popJobs[tempPop.job] == undefined) {
            popJobs[tempPop.job] = 0
        }
        popJobs[tempPop.job] += 1;
        if (popJobLevels[tempPop.category] == undefined) {
            popJobLevels[tempPop.category] = {}
        }
        popJobLevels[tempPop.category][pop] = tempPop;
        if (tempPop.happiness != undefined) {
            if (popHappiness[tempPop.species_index] == undefined) {
                popHappiness[tempPop.species_index] = { count: 0, happiness: 0 };
            }
            popHappiness[tempPop.species_index].count += 1
            popHappiness[tempPop.species_index].happiness += tempPop.happiness
        }
        if (popCount[data.species[tempPop.species_index].name] === undefined) {
            popCount[data.species[tempPop.species_index].name] = 0;
        }
        popCount[data.species[tempPop.species_index].name] += 1;
        if (tempPop.ethos != undefined) {
            if (popEthos[tempPop.ethos.ethic.split('ethic_')[1]] === undefined) {
                popEthos[tempPop.ethos.ethic.split('ethic_')[1]] = 0;
            }
            popEthos[tempPop.ethos.ethic.split('ethic_')[1]] += 1;
        }
        else {
            if(popEthos[data.species[tempPop.species_index].class] === undefined ){
                popEthos[data.species[tempPop.species_index].class] = 0
            }
            popEthos[data.species[tempPop.species_index].class] +=1;
        }
    }
    for (let species in popHappiness) {
        popHappiness[species].averageHappiness = popHappiness[species].happiness / popHappiness[species].count
    }
    mappings.popsPerSpecies = popsPerSpecies;
    mappings.popHappiness = popHappiness;
    for (let jobType in popJobLevels) {
        popJobLevels[jobType] = Object.keys(popJobLevels[jobType]).length
    }
    mappings.popJobLevels = popJobLevels;
    mappings.popsCount = popCount;
    mappings.popEthos = popEthos;
    mappings.popJobs = popJobs;
    return mappings;
}

/** */
function getCountryNames(data) {
    let countryList = {}
    for (let country in data.country) {
        countryList[country] = data.country[country].name
    }
    return countryList;
}


/** */
function mapPlanets(jn, mappings) {
    mappings.planetsByOwner = {};
    mappings.playersByCrime = {};
    mappings.districts = {}
    for (let planet in jn.planets.planet) {
        if (jn.planets.planet[planet].num_sapient_pops != 0) {
            let temp = jn.planets.planet[planet]
            if (mappings.planetsByOwner[temp.owner] === undefined) {
                mappings.planetsByOwner[temp.owner] = [];
            }
            mappings.planetsByOwner[temp.owner].push(temp);
            for (let district in temp.district) {
                if (temp.district[district].length > 1) {
                    if (mappings.districts[temp.district[district].split('_')[1]] === undefined) {
                        mappings.districts[temp.district[district].split('_')[1]] = 0;
                    }
                    mappings.districts[temp.district[district].split('_')[1]] += 1;
                }
                if (mappings.playersByCrime[temp.controller] === undefined) {
                    mappings.playersByCrime[temp.controller] = 0;
                }
                mappings.playersByCrime[temp.controller] += temp.crime;
            }
        }
    }

    return mappings;
}


/** */
function mapPops(jn, mappings) {

    return;
}




/**
 * This will pass the file to get this file i have used a parse written by jomini. 
 */
function parseFile() {
    var jomini = require('jomini');
    var str = fs.readFileSync('saves/mprelicwardens/autosave_2229.07.01/gamestate', 'utf8');//'savedata.txt', 'utf8');
    let data = jomini.parse(str);
    // const str = fs.readFileSync('save.json', 'utf8')
    // const data = JSON.parse(str)
    //var str = parseSplitJSON();
    //let data = JSON.parse(str)
    return data;
}


function main() {
    let jn = parseFile();
    let mappings = {}
    mappings = mapPlanets(jn, mappings);
    mappings.country = getCountryNames(jn)
    mappings.income = getIncomes(jn);
    mappings.stockpiles = getStockpiles(jn);
    mappings = totalMarketableResources(jn, mappings);
    mappings = totalFleets(jn, mappings);
    mappings.totalFleetPower = totalFleetPower(mappings);
    mappings.totalArmyPower = totalArmyPower(mappings);
    mappings.megastructures = getMegastructures(jn);
    mappings = getPopData(jn, mappings)
    delete mappings.popsPerSpecies;
    delete mappings.fleetByPlayer;
    delete mappings.armyByPlayer;
    saveFile('output2.json', JSON.stringify(mappings));
    saveFile('save.json', JSON.stringify(jn))
    return mappings;
}

main();
