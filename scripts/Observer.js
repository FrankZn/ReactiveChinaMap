class Topic {
    #name;
    #callbacks = [];

    constructor(name) {
        this.#name = name;
    }

    publish(obj) {
        this.#callbacks.forEach(callback => {
            callback(obj);
        });
    }

    subscribe(callback) {
        this.#callbacks.push(callback);
    }
}

export default class ObserverManagement {
    #topics = {};

    constructor() {
        
    }

    #get_topic(name) {
        if (name in this.#topics)
            return this.#topics[name];
        return this.#topics[name] = new Topic(name);
    }

    publish(name, obj) {
        let topic = this.#get_topic(name);
        topic.publish(obj);
        return this;
    }

    subscribe(name, callback) {
        let topic = this.#get_topic(name);
        topic.subscribe(callback);
        return this;
    }
}
