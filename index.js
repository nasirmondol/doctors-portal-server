const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const cors = require('cors')
require('dotenv').config()

const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jq3ba5c.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
  try {
    client.connect()
    const serviceCollection = client.db('doctors_portal').collection('services');
    const bookingCollection = client.db('doctors_portal').collection('booking')

    app.get('/v2/service', async (req, res) => {
      const date = req.query.date;
      console.log(date)
      const query = {};
      const services = await serviceCollection.find(query).toArray();
      const bookingQuery = { appointDate: date }
      const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();

      services.forEach(service => {
        const serviceBooked = alreadyBooked.filter(book => book.treatment1 === service.name)
        const bookSlots = serviceBooked.map(book => book.slot);
        const remainingSlots = service.slots.filter(slot => !bookSlots.includes(slot));

        service.slots = remainingSlots;
      })
      res.send(services);
    });

    // Aggregate
    app.get('/v2/service', async (req, res) => {
      const date = req.body.date;
      const services = await serviceCollection.aggregate([
        {
          $lookup: {
            from: 'bookings',
            localField: 'name',
            foreignField: "treatment1",
            pipeline: [
              {

                $match: {
                  $expr: {
                    $eq: ['appointmentDate', date]
                  }
                }
              }
            ],
            as: 'booked'
          }
        },
        {
          $project: {
            name: 1,
            slots: 1,
            $booked: {
              $map: {
                input: 'booked',
                as: 'book',
                in: '$$book.slot'
              }
            }
          }
        },
        {
          $project: {
            name: 1,
            slots: {
              $setDifference: ['$slots', '$booked']
            }
          }
        }
      ]).toArray()
      res.send(services)
    })

    app.post('/booking', async (req, res) => {
      const booking = req.body;
      console.log(booking) 

      const query = {
        appointDate: booking.appointDate,
        email: booking.email,
        treatment1: booking.treatment1
      }
      const alreadyBooked = await bookingCollection.find(query).toArray();
      if(alreadyBooked.length){
        const message = `You already have a booking on ${booking.appointDate}`
        return res.send({acknowledged: false, message})
      }


      const result = await bookingCollection.insertOne(booking)
      res.send(result);
    })

  }

  finally {

  }
}

run().catch(console.dir)


app.get('/', (req, res) => {
  res.send('Hello from doctors World!')
})

app.listen(port, () => {
  console.log(`listening on port server ${port}`)
})