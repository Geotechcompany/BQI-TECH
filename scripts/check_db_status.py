import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'Backend'))

from Backend.app.database import get_database
from bson import ObjectId

async def check_status():
    db = get_database()
    app = await db.applications.find_one({'_id': ObjectId('68b99f5417496a615ff87eba')})
    if app:
        print(f'Application status: {app.get("status", "No status field")}')
        print(f'Application updated at: {app.get("updatedAt", "No updatedAt field")}')
    else:
        print('Application not found')

if __name__ == "__main__":
    asyncio.run(check_status())
