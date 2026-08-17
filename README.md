This application contains 
1: A chrome extension : Which tracks the time you spent on a particular website 
2: Backend : Stores the data
3: Frontend react : where you can ask questions about your data 

AI layer:
I have used Langgraph here : Based on your query , the AI fetches creates the proper mongo db query to fetch relevant data from mongo db . The data then is converted to chunks and I use similarity search to give responses.

## The normal empty UI
<img width="1285" height="927" alt="image" src="https://github.com/user-attachments/assets/67f610d8-fa5d-40da-9295-b560e0f4f995" />

## The shortened response
<img width="1319" height="924" alt="image" src="https://github.com/user-attachments/assets/0d70f74d-2e1c-4a11-9cad-2073cc06e57a" />

## The full response 
<img width="855" height="873" alt="Screenshot 2026-08-17 at 1 54 09 PM" src="https://github.com/user-attachments/assets/bcd0c4ec-416a-4928-8df9-2a5ffb552527" />



