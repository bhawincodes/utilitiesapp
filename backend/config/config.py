from pymongo import MongoClient

url = "mongodb://localhost:27017"

client = MongoClient(url)

try:
    client.admin.command("ping")
    print("Pinged your command. you are successfully connected to MongoDB!")
except Exception as e:
    print(e)
