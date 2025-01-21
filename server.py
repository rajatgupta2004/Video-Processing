from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import os

app = Flask(__name__)
CORS(app)

@app.route('/upload', methods=['POST'])
def upload_video():
    try:
        video_file = request.files['video']
        roi = request.form.get('roi')
        selected_point = request.form.get('selected_point')

        # Parse ROI and selected point
        roi = [int(x) for x in roi.split(',')]
        selected_x, selected_y = [int(x) for x in selected_point.split(',')]

        video_path = os.path.join('uploaded_videos', video_file.filename)
        video_file.save(video_path)

        video = cv2.VideoCapture(video_path)
        total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))

        # Function to crop a region of interest (ROI)
        def crop_frame(frame, roi):
            x, y, w, h = roi
            return frame[y:y+h, x:x+w]

        # Arrays to store intensity values and timestamps
        intensity_values = np.zeros(total_frames)
        time_stamps = np.zeros(total_frames)

        # Loop through each frame to extract intensity at the selected point
        frame_count = 0
        while video.isOpened():
            ret, frame = video.read()
            if not ret:
                break

            cropped_frame = crop_frame(frame, roi)
            gray_frame = cv2.cvtColor(cropped_frame, cv2.COLOR_BGR2GRAY)

            # Ensure the selected point is within the cropped frame boundaries
            if 0 <= selected_x < gray_frame.shape[1] and 0 <= selected_y < gray_frame.shape[0]:
                intensity_values[frame_count] = gray_frame[selected_y, selected_x]
                time_stamps[frame_count] = video.get(cv2.CAP_PROP_POS_MSEC) / 1000  # Convert milliseconds to seconds

            frame_count += 1

        # Trim unused elements
        intensity_values = intensity_values[:frame_count]
        time_stamps = time_stamps[:frame_count]

        # Release the video
        video.release()

        return jsonify({
            'message': 'Video processed successfully!',
            'intensity_values': intensity_values.tolist(),
            'time_stamps': time_stamps.tolist()
        })

    except Exception as e:
        return jsonify({'message': f'Error: {str(e)}'})

if __name__ == '__main__':
    if not os.path.exists('uploaded_videos'):
        os.makedirs('uploaded_videos')
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
