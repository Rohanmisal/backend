
import mongoose from 'mongoose';

const subscriptionSchema = new Schema({
  subscriber: {
    type: Schema.Types.ObjectId,// one who is subscribeing
    ref: 'User',
    required: true
  },
  channel: {
    type: Schema.Types.ObjectId,// one whom 'subsriber' is subscribing
    ref: 'User',
    required: true
  }
}, {timestamp: true});


export const Subscription = mongoose.model('Subscription', subscriptionSchema)